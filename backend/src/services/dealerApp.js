import { sql } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';
import * as crm from './crmClient.js';
import { ensureContactPricebookForCrmAccount } from './commerceClient.js';
import { generateUniqueDealerCode } from '../utils/loginCode.js';
import { normalizePhone } from '../utils/phone.js';
import { normalizeEmail } from '../utils/validators.js';

/**
 * Dealer application:
 * 1. persist as pending (backend is the system of record for the application)
 * 2. create Account + Contact in Zoho CRM (CRM is the system of record for approval)
 *
 * If CRM is unreachable, the application stays pending with zoho ids null and
 * the crmPoll job retries creation — the applicant is never lost.
 */
export async function applyDealer({ user, businessName, gstNumber, gstTreatment, address, personName, firstName, lastName, phone }) {
  const existing = await sql`select id from dealers where owner_user_id = ${user.id}`;
  if (existing.length) {
    throw Object.assign(new Error('Dealer application already exists'), { statusCode: 409 });
  }

  const effectivePhone = (phone ? String(phone).trim() : null) || user.phone || null;
  const combinedName = personName || [firstName, lastName].filter(Boolean).join(' ') || user.full_name || null;

  // Auto-generate official Dealer Code in DE-ABC-1234 format
  const dealerCode = await generateUniqueDealerCode(sql, 'DE');

  const [dealer] = await sql`
    insert into dealers (owner_user_id, business_name, gst_number, gst_treatment, address, status, dealer_code)
    values (${user.id}, ${businessName}, ${gstNumber || null}, ${gstTreatment || null}, ${address || null}, 'pending', ${dealerCode})
    returning id, dealer_code`;

  await sql`update users set role = 'dealer', status = 'pending', dealer_id = ${dealer.id},
            full_name = coalesce(full_name, ${combinedName}),
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
      personName: combinedName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
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
  const newStatus = statusMap[account.dealerStatus] || (account.dealerStatus ? String(account.dealerStatus).toLowerCase() : 'pending');

  const targetPriceList = account.priceList || account.priceTier || null;

  // Ensure Zoho Commerce contact has the appropriate dealer pricebook attached
  if (account.zohoAccountId) {
    ensureContactPricebookForCrmAccount(account.zohoAccountId, targetPriceList).catch(() => {});
  }

  const cleanBusinessName = account.businessName ? String(account.businessName).trim() : null;
  const cleanGst = account.gstNumber ? String(account.gstNumber).trim().toUpperCase() : null;
  const cleanGstTreatment = account.gstTreatment ? String(account.gstTreatment).trim() : null;
  const cleanAddress = account.address ? String(account.address).trim() : null;

  const hasNameChange = Boolean(cleanBusinessName && cleanBusinessName !== dealer.business_name);
  const hasGstChange = Boolean(cleanGst && cleanGst !== dealer.gst_number);
  const hasTreatmentChange = Boolean(cleanGstTreatment && cleanGstTreatment !== dealer.gst_treatment);
  const hasAddressChange = Boolean(cleanAddress && cleanAddress !== dealer.address);
  const hasStatusChange = newStatus !== dealer.status;
  const hasCodeChange = Boolean(account.dealerCode && account.dealerCode !== dealer.dealer_code);
  const hasTierChange = Boolean(targetPriceList && targetPriceList !== dealer.price_tier);

  if (
    !hasNameChange &&
    !hasGstChange &&
    !hasTreatmentChange &&
    !hasAddressChange &&
    !hasStatusChange &&
    !hasCodeChange &&
    !hasTierChange
  ) {
    return false; // already converged
  }

  let effectiveCode = account.dealerCode || dealer.dealer_code;
  if (!effectiveCode && newStatus === 'approved') {
    effectiveCode = await generateUniqueDealerCode(sql, 'DE');
  }

  await sql`
    update dealers set
      business_name = coalesce(${cleanBusinessName}, business_name),
      gst_number = coalesce(${cleanGst}, gst_number),
      gst_treatment = coalesce(${cleanGstTreatment}, gst_treatment),
      address = coalesce(${cleanAddress}, address),
      status = ${newStatus},
      dealer_code = coalesce(${effectiveCode}, dealer_code),
      price_tier = coalesce(${targetPriceList}, price_tier),
      zoho_account_id = coalesce(${account.zohoAccountId}, zoho_account_id),
      reject_reason = ${newStatus === 'rejected' ? account.rejectReason || 'Rejected by owner in CRM' : null},
      approved_at = ${newStatus === 'approved' ? (dealer.approved_at || new Date().toISOString()) : null}
    where id = ${dealer.id}`;

  // Mirror the decision onto the owner user + kill their sessions on bad news
  if (newStatus === 'approved') {
    await sql`update users set status = 'active' where id = ${dealer.owner_user_id}`;
  } else if (newStatus === 'rejected' || newStatus === 'revoked') {
    await sql`update users set status = ${newStatus} where id = ${dealer.owner_user_id}`;
    await sql`update refresh_tokens set revoked = true where user_id = ${dealer.owner_user_id}`;
  }

  // Also sync primary contact info (name, phone, email) if available
  try {
    const ownerContact = await crm.getPrimaryContactForAccount(account.zohoAccountId || dealer.zoho_account_id);
    if (ownerContact) {
      const conName = ownerContact.fullName || [ownerContact.firstName, ownerContact.lastName].filter(Boolean).join(' ') || null;
      if (conName) {
        await sql`update users set full_name = ${conName} where id = ${dealer.owner_user_id}`;
      }
      if (ownerContact.email) {
        await sql`update users set email = coalesce(${ownerContact.email}, email) where id = ${dealer.owner_user_id}`;
      }
      if (ownerContact.phone) {
        const norm = normalizePhone(ownerContact.phone);
        if (norm.nationalNumber) {
          await sql`update users set phone = ${'+91' + norm.nationalNumber} where id = ${dealer.owner_user_id}`;
        }
      }
    }
  } catch (cErr) {
    log.warn(`[dealerApp:applyCrmAccountState] primary contact sync skipped: ${cErr.message}`);
  }

  await audit(dealer.owner_user_id, `dealer.${newStatus}`, 'dealer', dealer.id, {
    via: 'crm', zohoAccountId: account.zohoAccountId, businessName: cleanBusinessName, gstNumber: cleanGst,
  });
  return true;
}

/**
 * Apply CRM Contact updates (name, phone, email) onto the corresponding backend user.
 */
export async function applyCrmContactState(contact) {
  if (!contact?.zohoContactId) return false;
  const conName = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
  const conPhone = contact.phone ? normalizePhone(contact.phone) : null;
  const cleanPhone = conPhone?.nationalNumber ? `+91${conPhone.nationalNumber}` : null;
  const cleanEmail = contact.email ? normalizeEmail(contact.email) : null;

  const rows = await sql`
    select id, full_name, phone, email, status, role
    from users
    where zoho_contact_id = ${contact.zohoContactId}
    limit 1`;
  const user = rows[0];
  if (!user) return false;

  await sql`
    update users set
      full_name = coalesce(${conName}, full_name),
      phone = coalesce(${cleanPhone}, phone),
      email = coalesce(${cleanEmail}, email)
    where id = ${user.id}`;

  log.info(`[crm] Synced Contact ${contact.zohoContactId} to user ${user.id} (${conName || user.full_name})`);
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


