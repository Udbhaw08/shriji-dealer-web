import { Router } from 'express';
import crypto from 'node:crypto';
import { sql } from '../db/pool.js';
import { env } from '../config/env.js';
import { applyCrmAccountState, applyCrmContactState } from '../services/dealerApp.js';
import * as crm from '../services/crmClient.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';

export const webhooksRouter = Router();

/**
 * 2-way CRM synchronization webhook.
 * Handles Accounts & Contacts updates fired by Zoho CRM workflow rules.
 * Endpoints: /crm/approval, /crm/sync, /crm/update, /crm/webhook
 */
webhooksRouter.all(['/crm/approval', '/crm/sync', '/crm/update', '/crm/webhook'], async (req, res, next) => {
  try {
    // Query string secrets are forbidden (logged in access logs/proxies)
    if (req.query?.secret) {
      throw Object.assign(new Error('webhook secret in query string is forbidden; provide via X-Webhook-Secret header'), {
        statusCode: 400,
        publicMessage: 'secret_in_query_forbidden',
      });
    }

    const configuredSecret = env.webhookSecret || process.env.WEBHOOK_SECRET;
    if (!configuredSecret) {
      // In production, fail closed immediately if WEBHOOK_SECRET is unconfigured
      if (process.env.NODE_ENV === 'production') {
        throw Object.assign(new Error('webhook service unconfigured: WEBHOOK_SECRET missing in production'), {
          statusCode: 503,
          publicMessage: 'service_unavailable',
        });
      }
      throw Object.assign(new Error('webhook secret required'), {
        statusCode: 401,
        publicMessage: 'unauthorized',
      });
    }

    const headerSecret =
      req.headers['x-webhook-secret'] ||
      req.headers['webhook-secret'] ||
      req.headers['x-api-key'] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (typeof headerSecret !== 'string') {
      throw Object.assign(new Error('missing X-Webhook-Secret header'), {
        statusCode: 401,
        publicMessage: 'unauthorized',
      });
    }

    const headerBuf = Buffer.from(headerSecret);
    const secretBuf = Buffer.from(configuredSecret);
    if (headerBuf.length !== secretBuf.length || !crypto.timingSafeEqual(headerBuf, secretBuf)) {
      throw Object.assign(new Error('invalid webhook secret'), {
        statusCode: 401,
        publicMessage: 'unauthorized',
      });
    }

    const payload = req.body || {};
    const query = req.query || {};

    const rawStr = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(payload));
    const payloadHash = crypto.createHash('sha256').update(rawStr + JSON.stringify(query)).digest('hex');

    const seen = await sql`
      select id from webhook_events
      where source = 'crm'
        and payload_hash = ${payloadHash}
        and processed_at > now() - interval '2 minutes'
      limit 1`;
    if (seen.length) {
      log.info(`[webhook] CRM event deduped within 2m window (${payloadHash.slice(0, 8)})`);
      return res.json({ ok: true, deduped: true });
    }

    const rawBodyId =
      typeof req.body === 'string' && /^\d{10,25}$/.test(req.body.trim())
        ? req.body.trim()
        : typeof req.body === 'number'
          ? String(req.body)
          : null;

    const refId =
      payload.id || query.id ||
      payload.account_id || query.account_id ||
      payload.Account_ID || query.Account_ID ||
      payload.contact_id || query.contact_id ||
      payload.Contact_ID || query.Contact_ID ||
      payload.entity_id || query.entity_id ||
      payload.data?.[0]?.id ||
      req.headers['x-account-id'] ||
      req.headers['x-contact-id'] ||
      req.headers['account_id'] ||
      rawBodyId ||
      null;

    await sql`insert into webhook_events (source, ref_id, payload_hash, processed_at) values ('crm', ${String(refId || '')}, ${payloadHash}, now())`;

    if (!refId) {
      log.warn('[webhook] CRM webhook without a resolvable id:', JSON.stringify(payload).slice(0, 200));
      return res.json({ ok: true, ignored: 'no_id' });
    }

    const explicitModule = payload.module || query.module || req.headers['x-module'] || req.headers['module'] || null;

    // Check if this refId is a Contact
    let isContact = explicitModule === 'Contacts' || Boolean(payload.contact_id || query.contact_id || payload.Contact_ID || query.Contact_ID);
    if (!isContact && !explicitModule) {
      const contactUser = await sql`select id from users where zoho_contact_id = ${String(refId)} limit 1`;
      if (contactUser.length) isContact = true;
    }

    if (isContact) {
      if (!crm.isCrmConfigured()) return res.json({ ok: false, error: 'CRM_NOT_CONFIGURED' });
      const contact = await crm.getDealerContact(String(refId));
      if (!contact) return res.json({ ok: true, ignored: 'contact_unreadable' });
      const changed = await applyCrmContactState(contact);
      if (!contact.userSource && contact.accountId) {
        try {
          const acc = await crm.getDealerAccount(contact.accountId);
          await crm.syncAccountUserSourceToContacts(contact.accountId, acc?.userSource || 'ReStor Dealer');
        } catch (sErr) {
          log.warn(`[webhook] User source sync to contact ${refId} skipped: ${sErr.message}`);
        }
      }
      log.info(`[webhook] Contact ${refId} synced from CRM (changed: ${changed})`);
      return res.json({ ok: true, module: 'Contacts', id: refId, changed });
    }

    // Otherwise, treat as an Account
    let rows = await sql`select * from dealers where zoho_account_id = ${String(refId)}`;
    if (!rows.length && (payload.Dealer_Code || query.Dealer_Code)) {
      rows = await sql`select * from dealers where dealer_code = ${String(payload.Dealer_Code || query.Dealer_Code)}`;
    }
    const dealer = rows[0];
    if (!dealer) {
      log.warn(`[webhook] no local dealer for CRM account ${refId}`);
      return res.json({ ok: true, ignored: 'unknown_account' });
    }

    if (!crm.isCrmConfigured()) return res.json({ ok: false, error: 'CRM_NOT_CONFIGURED' });
    const account = await crm.getDealerAccount(dealer.zoho_account_id || String(refId));
    if (!account) return res.json({ ok: true, ignored: 'account_unreadable' });

    const changed = await applyCrmAccountState(dealer, account);
    if (changed) {
      await audit(dealer.owner_user_id, `dealer.crm_sync`, 'dealer', dealer.id, {
        via: 'webhook', businessName: account.businessName, gstNumber: account.gstNumber,
      });
      log.info(`[webhook] synced dealer ${dealer.id} from CRM: ${account.businessName || 'Business'} (GST: ${account.gstNumber || 'N/A'}, status: ${account.dealerStatus})`);
    }
    res.json({
      ok: true,
      module: 'Accounts',
      id: refId,
      status: account.dealerStatus,
      business_name: account.businessName,
      gst_number: account.gstNumber,
      changed,
    });
  } catch (err) { next(err); }
});


