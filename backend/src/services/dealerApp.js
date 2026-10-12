import { sql } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';
import * as crm from './crmClient.js';
import { ensureContactPricebookForCrmAccount } from './commerceClient.js';
import { generateUniqueDealerCode } from '../utils/loginCode.js';

/**
 * Dealer application:
 * 1. persist as pending (backend is the system of record for the application)
 * 2. create Account + Contact in Zoho CRM (CRM is the system of record for approval)
 *
 * If CRM is unreachable, the application stays pending with zoho ids null and
 * the crmPoll job retries creation — the applicant is never lost.
 */
export async function applyDealer({ user, businessName, gstNumber, gstTreatment, address, personName, phone }) {
  const existing = await sql`select id from dealers where owner_user_id = ${user.id}`;
  if (existing.length) {
    throw Object.assign(new Error('Dealer application already exists'), { statusCode: 409 });
  }

  const effectivePhone = (phone ? String(phone).trim() : null) || user.phone || null;

  // Auto-generate official Dealer Code in DE-ABC-1234 format
  const dealerCode = await generateUniqueDealerCode(sql, 'DE');

  const [dealer] = await sql`
    insert into dealers (owner_user_id, business_name, gst_number, gst_treatment, address, status, dealer_code)
    values (${user.id}, ${businessName}, ${gstNumber || null}, ${gstTreatment || null}, ${address || null}, 'pending', ${dealerCode})
    returning id, dealer_code`;

  await sql`update users set role = 'dealer', status = 'pending', dealer_id = ${dealer.id},
            phone = coalesce(phone, ${effectivePhone}) where id = ${user.id}`;

  let zohoAccountId = null;
  try {
    zohoAccountId = await crm.createDealerAccount({
      businessName,
      gstNumber,
      gstTreatment,
      phone: effectivePhone,
      email: user.email,
      address,
      userSource: 'ReStor Dealer',
      dealerCode,
    });
    const contactId = await crm.createDealerContact({
      accountId: zohoAccountId,
      personName: personName || user.full_name,
      phone: effectivePhone,
      email: user.email,
      portalRole: 'Owner',
      userSource: 'ReStor Dealer',
      dealerCode,
    });
    await crm.linkContactToBackendUser(contactId, user.id);
    await sql`update dealers set zoho_account_id = ${zohoAccountId} where id = ${dealer.id}`;
    await sql`update users set zoho_contact_id = ${contactId} where id = ${user.id}`;
    ensureContactPricebookForCrmAccount(zohoAccountId).catch(() => {});
  } catch (err) {
    if (err.message === 'CRM_NOT_CONFIGURED') {
      log.warn(`[dealerApp] CRM not configured — dealer ${dealer.id} stays pending for crmPoll`);
    } else {
      log.error(`[dealerApp] CRM create failed for dealer ${dealer.id}:`, err.message);
    }
    await audit(user.id, 'dealer.crm_create_failed', 'dealer', dealer.id, { error: err.message });
  }

  await audit(user.id, 'dealer.applied', 'dealer', dealer.id, { businessName, gstNumber, gstTreatment, zohoAccountId });
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

  const targetPriceList = account.priceList || account.priceTier || null;

  // Ensure Zoho Commerce contact has the appropriate dealer pricebook attached
  if (account.zohoAccountId) {
    ensureContactPricebookForCrmAccount(account.zohoAccountId, targetPriceList).catch(() => {});
  }

  if (
    dealer.status === newStatus &&
    dealer.dealer_code === account.dealerCode &&
    dealer.price_tier === targetPriceList
  ) {
    return false; // already converged
  }

  let effectiveCode = account.dealerCode || dealer.dealer_code;
  if (!effectiveCode && newStatus === 'approved') {
    effectiveCode = await generateUniqueDealerCode(sql, 'DE');
  }

  await sql`
    update dealers set
      status = ${newStatus},
      dealer_code = coalesce(${effectiveCode}, dealer_code),
      price_tier = coalesce(${targetPriceList}, price_tier),
      zoho_account_id = coalesce(${account.zohoAccountId}, zoho_account_id),
      gst_number = coalesce(${account.gstNumber}, gst_number),
      gst_treatment = coalesce(${account.gstTreatment}, gst_treatment),
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

/**
 * Deactivates a dealer (dealership inactive / terminated) without deleting any records.
 * Marks dealer status as 'revoked', updates Zoho CRM Account Dealer_Status to 'Revoked',
 * deactivates all staff & owner access and revokes all active session tokens.
 */
export async function deactivateDealer(dealerId, reason = 'Dealership Inactive') {
  const dealerRows = await sql`select * from dealers where id = ${dealerId}`;
  const dealer = dealerRows[0];
  if (!dealer) return false;

  // 1. Mark dealer as revoked/inactive in database
  await sql`
    update dealers
    set status = 'revoked', reject_reason = ${reason}
    where id = ${dealer.id}`;

  // 2. Mark owner user status as inactive and kill sessions
  await sql`update users set status = 'inactive' where id = ${dealer.owner_user_id}`;
  await sql`update refresh_tokens set revoked = true where user_id = ${dealer.owner_user_id}`;

  // 3. Mark all staff users under this dealer as inactive and kill sessions
  const staffMembers = await sql`select id, zoho_contact_id from users where dealer_id = ${dealer.id}`;
  for (const s of staffMembers) {
    await sql`update users set status = 'inactive' where id = ${s.id}`;
    await sql`update refresh_tokens set revoked = true where user_id = ${s.id}`;
    if (s.zoho_contact_id) {
      await crm.deactivateContactInCrm(s.zoho_contact_id, 'Inactive').catch(() => {});
    }
  }

  // 4. Update Zoho CRM Account Dealer_Status to 'Revoked' (no deletion)
  if (dealer.zoho_account_id) {
    await crm.deactivateAccountInCrm(dealer.zoho_account_id, 'Revoked').catch(() => {});
  }

  // 5. Update owner Contact in Zoho CRM to 'Inactive' (no deletion)
  const ownerRows = await sql`select zoho_contact_id from users where id = ${dealer.owner_user_id}`;
  if (ownerRows[0]?.zoho_contact_id) {
    await crm.deactivateContactInCrm(ownerRows[0].zoho_contact_id, 'Inactive').catch(() => {});
  }

  // 6. Revoke pending invites
  await sql`update staff_invites set revoked = true where dealer_id = ${dealer.id}`;

  await audit(dealer.owner_user_id, 'dealer.deactivated', 'dealer', dealer.id, { reason });
  log.info(`[dealerApp] Deactivated dealer ${dealer.id} and updated Zoho CRM status to Revoked/Inactive (no deletion)`);
  return true;
}

export { deactivateDealer as deleteDealer };


