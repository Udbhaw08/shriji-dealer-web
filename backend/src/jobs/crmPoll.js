import { sql } from '../db/pool.js';
import { applyCrmAccountState } from '../services/dealerApp.js';
import * as crm from '../services/crmClient.js';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';

async function markPollRun() {
  await sql`insert into sync_state (key, value) values ('last_crm_poll_at', ${new Date().toISOString()})
            on conflict (key) do update set value = excluded.value`;
}

/**
 * Fallback for lost webhooks + retry for CRM-creation failures.
 * Every 5 minutes:
 *  1. pending dealers without a zoho_account_id → try creating Account/Contact again
 *  2. all pending dealers → re-fetch the Account from CRM and converge status
 */
export async function crmPoll() {
  if (!crm.isCrmConfigured()) return;

  // 1. retry CRM record creation for applications that failed earlier (zoho_account_id is null)
  const unlinkedAccounts = await sql`
    select d.id, d.business_name, d.gst_number, d.gst_treatment, d.address, d.dealer_code,
           u.id as owner_id, u.email, u.phone, u.full_name
    from dealers d join users u on u.id = d.owner_user_id
    where d.status = 'pending' and d.zoho_account_id is null`;
  for (const d of unlinkedAccounts) {
    try {
      const accountId = await crm.createDealerAccount({
        businessName: d.business_name,
        gstNumber: d.gst_number,
        gstTreatment: d.gst_treatment,
        phone: d.phone,
        email: d.email,
        address: d.address,
        userSource: 'ReStor Dealer',
        dealerCode: d.dealer_code,
      });
      if (accountId) {
        await sql`update dealers set zoho_account_id = ${accountId} where id = ${d.id}`;
        d.zoho_account_id = accountId;
        log.info(`[crmPoll] created CRM account ${accountId} for dealer ${d.id} (dealer_code: ${d.dealer_code})`);
      }
    } catch (err) {
      log.warn(`[crmPoll] CRM account create retry failed for dealer ${d.id}: ${err.message}`);
    }
  }

  // 2. resume Owner Contact provisioning for dealers with Account ID but missing Contact ID
  const unlinkedContacts = await sql`
    select d.id, d.business_name, d.dealer_code, d.zoho_account_id,
           u.id as owner_id, u.email, u.phone, u.full_name
    from dealers d join users u on u.id = d.owner_user_id
    where d.zoho_account_id is not null and u.zoho_contact_id is null`;
  for (const d of unlinkedContacts) {
    try {
      // First attempt recovery within this already-linked Account using Backend_User_ID / identity
      const existingContact = await crm.findOwnerContactInAccount(d.zoho_account_id, {
        backendUserId: d.owner_id,
        email: d.email,
        phone: d.phone,
      });

      if (existingContact?.ambiguous) {
        log.warn(`[crmPoll] Ambiguous contacts under account ${d.zoho_account_id} for user ${d.owner_id}; skipping auto-link`);
        continue;
      }

      let contactId = existingContact?.zohoContactId || null;
      if (!contactId) {
        contactId = await crm.createDealerContact({
          accountId: d.zoho_account_id,
          personName: d.full_name || d.business_name,
          phone: d.phone,
          email: d.email,
          portalRole: 'Owner',
          userSource: 'ReStor Dealer',
          dealerCode: d.dealer_code,
          backendUserId: d.owner_id,
        });
      }

      await crm.linkContactToBackendUser(contactId, d.owner_id, { userSource: 'ReStor Dealer' });
      await sql`update users set zoho_contact_id = ${contactId} where id = ${d.owner_id}`;
      await crm.syncAccountUserSourceToContacts(d.zoho_account_id, 'ReStor Dealer').catch(() => {});
      log.info(`[crmPoll] linked dealer ${d.id} → CRM contact ${contactId}`);
    } catch (err) {
      log.warn(`[crmPoll] CRM contact create/link retry failed for dealer ${d.id}: ${err.message}`);
    }
  }

  // 2. converge status and price tier for pending & approved dealers (webhook fallback)
  const activeDealers = await sql`
    select * from dealers where status in ('pending', 'approved') and zoho_account_id is not null`;
  for (const dealer of activeDealers) {
    try {
      const account = await crm.getDealerAccount(dealer.zoho_account_id);
      if (!account) continue;
      const changed = await applyCrmAccountState(dealer, account);
      if (changed) log.info(`[crmPoll] dealer ${dealer.id} → ${account.dealerStatus}`);
    } catch (err) {
      log.warn(`[crmPoll] status sync failed for dealer ${dealer.id}: ${err.message}`);
    }
  }

  await markPollRun();
}

export const POLL_INTERVAL_MS = env.crmPollMinutes * 60 * 1000;
