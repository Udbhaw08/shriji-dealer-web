import { Router } from 'express';
import crypto from 'node:crypto';
import { sql } from '../db/pool.js';
import { env } from '../config/env.js';
import { applyCrmAccountState } from '../services/dealerApp.js';
import * as crm from '../services/crmClient.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';

export const webhooksRouter = Router();

/**
 * POST /webhooks/crm/approval — fired by the CRM workflow rule when Dealer Status changes.
 * Security: shared secret header (X-Webhook-Secret). Trust nothing in the payload beyond
 * the Account id — the Account is re-fetched from CRM as the source of truth.
 * Idempotency: payload hash is recorded in webhook_events; replays are ignored.
 */
webhooksRouter.post('/crm/approval', async (req, res, next) => {
  try {
    if (env.webhookSecret && req.headers['x-webhook-secret'] !== env.webhookSecret) {
      throw Object.assign(new Error('invalid webhook secret'), { statusCode: 401, publicMessage: 'unauthorized' });
    }

    const payloadHash = crypto
      .createHash('sha256')
      .update(req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})))
      .digest('hex');

    const seen = await sql`
      select id from webhook_events where source = 'crm' and payload_hash = ${payloadHash} limit 1`;
    if (seen.length) return res.json({ ok: true, deduped: true });

    const refId =
      req.body?.id || req.body?.account_id || req.body?.Account_ID || req.body?.data?.[0]?.id || null;
    await sql`insert into webhook_events (source, ref_id, payload_hash) values ('crm', ${String(refId || '')}, ${payloadHash})`;

    if (!refId) {
      log.warn('[webhook] CRM approval webhook without a resolvable account id:', JSON.stringify(req.body).slice(0, 200));
      return res.json({ ok: true, ignored: 'no_account_id' });
    }

    // find the dealer by the CRM account id — or by matching dealer_code when linked later
    let rows = await sql`select * from dealers where zoho_account_id = ${String(refId)}`;
    if (!rows.length && req.body?.Dealer_Code) {
      rows = await sql`select * from dealers where dealer_code = ${String(req.body.Dealer_Code)}`;
    }
    const dealer = rows[0];
    if (!dealer) {
      log.warn(`[webhook] no local dealer for CRM account ${refId}`);
      return res.json({ ok: true, ignored: 'unknown_account' });
    }

    // CRM is master — re-fetch, never trust payload status fields
    const account = await crm.getDealerAccount(dealer.zoho_account_id || String(refId));
    if (!account) return res.json({ ok: true, ignored: 'account_unreadable' });

    const changed = await applyCrmAccountState(dealer, account);
    if (changed) {
      await audit(dealer.owner_user_id, `dealer.${account.dealerStatus.toLowerCase()}`, 'dealer', dealer.id, { via: 'webhook' });
      log.info(`[webhook] dealer ${dealer.id} → ${account.dealerStatus}`);
    }
    res.json({ ok: true, status: account.dealerStatus, changed });
  } catch (err) { next(err); }
});
