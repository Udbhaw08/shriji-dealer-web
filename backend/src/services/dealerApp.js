import { sql } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';
import * as crm from './crmClient.js';

/**
 * Dealer application:
 * 1. persist as pending (backend is the system of record for the application)
 * 2. create Account + Contact in Zoho CRM (CRM is the system of record for approval)
 *
 * If CRM is unreachable, the application stays pending with zoho ids null and
 * the crmPoll job retries creation — the applicant is never lost.
 */
export async function applyDealer({ user, businessName, gstNumber, address, personName, phone }) {
  const existing = await sql`select id from dealers where owner_user_id = ${user.id}`;
  if (existing.length) {
    throw Object.assign(new Error('Dealer application already exists'), { statusCode: 409 });
  }

  const [dealer] = await sql`
    insert into dealers (owner_user_id, business_name, gst_number, address, status)
    values (${user.id}, ${businessName}, ${gstNumber || null}, ${address || null}, 'pending')
    returning id`;

  await sql`update users set role = 'dealer', status = 'pending', dealer_id = ${dealer.id},
            phone = coalesce(phone, ${phone || null}) where id = ${user.id}`;

  let zohoAccountId = null;
  try {
    zohoAccountId = await crm.createDealerAccount({ businessName, gstNumber, phone, email: user.email, address });
    const contactId = await crm.createDealerContact({
      accountId: zohoAccountId, personName, phone, email: user.email, portalRole: 'Owner',
    });
    await crm.linkContactToBackendUser(contactId, user.id);
    await sql`update dealers set zoho_account_id = ${zohoAccountId} where id = ${dealer.id}`;
    await sql`update users set zoho_contact_id = ${contactId} where id = ${user.id}`;
  } catch (err) {
    if (err.message === 'CRM_NOT_CONFIGURED') {
      log.warn(`[dealerApp] CRM not configured — dealer ${dealer.id} stays pending for crmPoll`);
    } else {
      log.error(`[dealerApp] CRM create failed for dealer ${dealer.id}:`, err.message);
    }
    await audit(user.id, 'dealer.crm_create_failed', 'dealer', dealer.id, { error: err.message });
  }

  await audit(user.id, 'dealer.applied', 'dealer', dealer.id, { businessName, gstNumber, zohoAccountId });
  return dealer.id;
}

/**
 * One CRM Account → backend sync step. Shared by the approval webhook and the
 * 5-minute fallback poll: CRM is re-fetched as the source of truth before this runs.
 * Returns true when the dealer row changed.
 */
export async function applyCrmAccountState(dealer, account) {
  const statusMap = { Approved: 'approved', Rejected: 'rejected', Revoked: 'revoked', Pending: 'pending' };
  const newStatus = statusMap[account.dealerStatus] || 'pending';

  if (dealer.status === newStatus && dealer.dealer_code === account.dealerCode) {
    return false; // already converged
  }

  await sql`
    update dealers set
      status = ${newStatus},
      dealer_code = coalesce(${account.dealerCode}, dealer_code),
      price_tier = coalesce(${account.priceTier}, price_tier),
      zoho_account_id = coalesce(${account.zohoAccountId}, zoho_account_id),
      reject_reason = ${newStatus === 'rejected' ? account.rejectReason || 'Rejected by owner in CRM' : null},
      approved_at = ${newStatus === 'approved' ? new Date().toISOString() : null}
    where id = ${dealer.id}`;

  // Mirror the decision onto the owner user + kill their sessions on bad news
  if (newStatus === 'approved') {
    await sql`update users set status = 'active' where id = ${dealer.owner_user_id}`;
  } else if (newStatus === 'rejected' || newStatus === 'revoked') {
    await sql`update users set status = ${newStatus} where id = ${dealer.owner_user_id}`;
    await sql`update refresh_tokens set revoked = true where user_id = ${dealer.owner_user_id}`;
  }

  await audit(dealer.owner_user_id, `dealer.${newStatus}`, 'dealer', dealer.id, {
    via: 'crm', zohoAccountId: account.zohoAccountId,
  });
  return true;
}
