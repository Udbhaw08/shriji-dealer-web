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

  // 1. retry CRM record creation for applications that failed earlier
  const unlinked = await sql`
    select d.id, d.business_name, d.gst_number, d.address, u.id as owner_id,
           u.email, u.phone
    from dealers d join users u on u.id = d.owner_user_id
    where d.status = 'pending' and d.zoho_account_id is null`;
  for (const d of unlinked) {
    try {
      const accountId = await crm.createDealerAccount({
        businessName: d.business_name, gstNumber: d.gst_number,
        phone: d.phone, email: d.email, address: d.address,
      });
      const contactId = await crm.createDealerContact({
        accountId, personName: d.business_name, phone: d.phone, email: d.email, portalRole: 'Owner',
      });
      await crm.linkContactToBackendUser(contactId, d.owner_id);
      await sql`update dealers set zoho_account_id = ${accountId} where id = ${d.id}`;
      await sql`update users set zoho_contact_id = ${contactId} where id = ${d.owner_id}`;
      log.info(`[crmPoll] linked dealer ${d.id} → CRM account ${accountId}`);
    } catch (err) {
      log.warn(`[crmPoll] CRM create retry failed for dealer ${d.id}: ${err.message}`);
    }
  }

  // 2. converge status for every pending dealer (webhook fallback)
  const pending = await sql`
    select * from dealers where status = 'pending' and zoho_account_id is not null`;
  for (const dealer of pending) {
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
