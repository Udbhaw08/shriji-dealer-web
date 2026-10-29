import { env } from '../config/env.js';
import { log } from '../utils/logger.js';
import { normalizePhone } from '../utils/phone.js';
import { normalizeEmail, cleanName } from '../utils/validators.js';

// Custom-field API names in CRM. These defaults match the fields created in
// docs/BACKEND-ARCHITECTURE.md §1.1 — override via env if Zoho assigns different
// api_names on creation (check in CRM → Setup → Modules → Accounts/Contacts).
export const FIELDS = {
  account: {
    gst: () => process.env.ZOHO_CRM_FIELD_GST || 'GST_Number',
    gstTreatment: () => process.env.ZOHO_CRM_FIELD_GST_TREATMENT || 'GST_Treatment',
    dealerStatus: () => process.env.ZOHO_CRM_FIELD_DEALER_STATUS || 'Dealer_Status',
    dealerCode: () => process.env.ZOHO_CRM_FIELD_DEALER_CODE || 'Dealer_Code',
    priceList: () => process.env.ZOHO_CRM_FIELD_PRICE_LIST || 'Price_List',
    priceTier: () => process.env.ZOHO_CRM_FIELD_PRICE_LIST || process.env.ZOHO_CRM_FIELD_PRICE_TIER || 'Price_List',
    userSource: () => process.env.ZOHO_CRM_FIELD_USER_SOURCE || 'User_Source',
  },
  contact: {
    portalRole: () => process.env.ZOHO_CRM_FIELD_PORTAL_ROLE || 'Portal_Role',
    backendUserId: () => process.env.ZOHO_CRM_FIELD_BACKEND_USER_ID || 'Backend_User_ID',
    userSource: () => process.env.ZOHO_CRM_FIELD_USER_SOURCE || 'User_Source',
    countryCode: () => process.env.ZOHO_CRM_FIELD_COUNTRY_CODE || 'Country_Code',
  },
};

let cachedToken = null; // { token, expiresAt }

const crmConfigured = () =>
  env.zoho.crm.clientId && env.zoho.crm.clientSecret && env.zoho.crm.refreshToken;

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`https://accounts.zoho.${env.zoho.dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.zoho.crm.clientId,
      client_secret: env.zoho.crm.clientSecret,
      refresh_token: env.zoho.crm.refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`CRM token refresh failed: ${data.error || res.status}`);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

export async function crmFetch(path, { method = 'GET', body } = {}) {
  if (!crmConfigured()) {
    throw new Error('CRM_NOT_CONFIGURED');
  }
  const run = async (token) => {
    const url = `https://www.zohoapis.${env.zoho.dc}/crm/v2${path}`;
    return fetch(url, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let res = await run(await getAccessToken());
  if (res.status === 401) {
    cachedToken = null; // auto-recovery, same pattern as api/zoho.js
    res = await run(await getAccessToken({ forceRefresh: true }));
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`CRM ${method} ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

/** Create the dealer Account in CRM. Returns the CRM Account id. */
export async function createDealerAccount({ businessName, gstNumber, gstTreatment, phone, email, address, city, state, pin, pincode, userSource = 'ReStor Dealer', dealerCode }) {
  const norm = normalizePhone(phone);
  const account = {
    Account_Name: cleanName(businessName),
    Phone: norm.nationalNumber || undefined,
    Email: normalizeEmail(email) || undefined,
    Billing_Street: address || undefined,
    Billing_City: city || undefined,
    Billing_State: state || undefined,
    Billing_Code: pincode || pin || undefined,
    [FIELDS.account.gst()]: gstNumber || undefined,
    ...(gstTreatment ? { [FIELDS.account.gstTreatment()]: String(gstTreatment).trim() } : {}),
    [FIELDS.account.dealerStatus()]: 'Pending',
    ...(userSource ? { [FIELDS.account.userSource()]: userSource } : {}),
    ...(dealerCode ? { [FIELDS.account.dealerCode()]: String(dealerCode).trim() } : {}),
  };
  const data = await crmFetch('/Accounts', {
    method: 'POST',
    body: { data: [account] },
  });
  const row = data?.data?.[0];
  if (!row || row.status !== 'success' || !row.details?.id) {
    throw new Error(`CRM account create failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return row.details.id;
}

/**
 * Resolves first and last names for Zoho CRM Contact.
 * Ensures First_Name and Last_Name are always populated and never left empty.
 */
export function resolveContactNames({ firstName, lastName, personName, defaultLast = 'Dealer Owner' }) {
  let fName = firstName ? String(firstName).trim() : '';
  let lName = lastName ? String(lastName).trim() : '';

  if (!fName && !lName && personName) {
    const parts = String(personName).trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      fName = parts.slice(0, -1).join(' ');
      lName = parts.slice(-1).join(' ');
    } else if (parts.length === 1) {
      // In Zoho CRM, Last_Name is mandatory, while First_Name is optional.
      // Setting First_Name = parts[0] AND Last_Name = parts[0] causes Zoho CRM to display
      // duplicated names ("udbhaw udbhaw", "api api"). Leaving First_Name empty ensures
      // Zoho displays the single clean name ("udbhaw", "api").
      fName = '';
      lName = parts[0];
    } else {
      fName = '';
      lName = defaultLast;
    }
  }

  // If lastName is empty but firstName is provided, shift it to lastName (mandatory in Zoho CRM)
  if (!lName && fName) {
    lName = fName;
    fName = '';
  }

  return {
    firstName: cleanName(fName) || '',
    lastName: cleanName(lName) || defaultLast,
  };
}

/** Create a Contact under the dealer Account. Returns the CRM Contact id. */
export async function createDealerContact({
  accountId,
  personName,
  firstName,
  lastName,
  phone,
  email,
  portalRole = 'Owner',
  dealerCode,
  userSource = 'ReStor Dealer',
  reportingToContactId,
  backendUserId,
}) {
  const norm = normalizePhone(phone);
  const defaultLast = portalRole === 'Staff' ? 'Dealer Staff' : 'Dealer Owner';
  const names = resolveContactNames({ firstName, lastName, personName, defaultLast });

  const contact = {
    ...(names.firstName ? { First_Name: names.firstName } : {}),
    Last_Name: names.lastName,
    Account_Name: { id: accountId },
    Phone: norm.nationalNumber || undefined,
    Mobile: norm.nationalNumber || undefined,
    Email: normalizeEmail(email) || undefined,
    [FIELDS.contact.portalRole()]: portalRole,
    ...(norm.countryCode ? { [FIELDS.contact.countryCode()]: norm.countryCode } : {}),
    ...(dealerCode ? { [FIELDS.account.dealerCode()]: dealerCode } : {}),
    ...(userSource ? { [FIELDS.contact.userSource()]: userSource } : {}),
    ...(reportingToContactId ? { Reporting_To: { id: reportingToContactId } } : {}),
    ...(backendUserId ? { [FIELDS.contact.backendUserId()]: String(backendUserId) } : {}),
  };
  const data = await crmFetch('/Contacts', {
    method: 'POST',
    body: { data: [contact] },
  });
  const row = data?.data?.[0];
  if (!row || row.status !== 'success' || !row.details?.id) {
    throw new Error(`CRM contact create failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return row.details.id;
}

/** Stamp the backend user id onto a CRM Contact so both systems can link. */
export async function linkContactToBackendUser(contactId, backendUserId) {
  await crmFetch(`/Contacts/${contactId}`, {
    method: 'PUT',
    body: { data: [{ id: contactId, [FIELDS.contact.backendUserId()]: backendUserId }] },
  });
}

/**
 * Read a dealer Account from CRM — the source of truth for approval & profile.
 * Returns { zohoAccountId, dealerStatus, dealerCode, priceList, priceTier, businessName, gstNumber, gstTreatment, phone, address } or null.
 */
export async function getDealerAccount(zohoAccountId) {
  const data = await crmFetch(`/Accounts/${zohoAccountId}`);
  const acc = data?.data?.[0];
  if (!acc) return null;
  const priceListVal = acc[FIELDS.account.priceList()] || acc.Price_List || acc['Price List'] || acc.Price_Tier || null;
  const addressParts = [
    acc.Billing_Street,
    acc.Billing_City,
    acc.Billing_State,
    acc.Billing_Code,
  ].filter(Boolean);
  return {
    zohoAccountId: acc.id,
    dealerStatus: acc[FIELDS.account.dealerStatus()] || acc.Dealer_Status || 'Pending',
    dealerCode: acc[FIELDS.account.dealerCode()] || acc.Dealer_Code || null,
    priceList: priceListVal,
    priceTier: priceListVal,
    businessName: acc.Account_Name || null,
    gstNumber: acc[FIELDS.account.gst()] || acc.GST_Number || acc.GSTIN || acc.GST || null,
    gstTreatment: acc[FIELDS.account.gstTreatment()] || acc.GST_Treatment || null,
    phone: acc.Phone || null,
    address: addressParts.length ? addressParts.join(', ') : null,
    city: acc.Billing_City || null,
    state: acc.Billing_State || null,
    pincode: acc.Billing_Code || null,
  };
}

/**
 * Read a Contact from CRM.
 * Returns { zohoContactId, firstName, lastName, fullName, email, phone, portalRole, accountId } or null.
 */
export async function getDealerContact(zohoContactId) {
  const data = await crmFetch(`/Contacts/${zohoContactId}`);
  const con = data?.data?.[0];
  if (!con) return null;
  return {
    zohoContactId: con.id,
    firstName: con.First_Name || null,
    lastName: con.Last_Name || null,
    fullName: con.Full_Name || [con.First_Name, con.Last_Name].filter(Boolean).join(' ') || null,
    email: con.Email || null,
    phone: con.Phone || con.Mobile || null,
    portalRole: con[FIELDS.contact.portalRole()] || con.Portal_Role || null,
    dealerCode: con[FIELDS.account.dealerCode()] || null,
    accountId: con.Account_Name?.id || null,
  };
}

/**
 * Search contacts under a CRM Account and return the primary owner contact.
 */
export async function getPrimaryContactForAccount(zohoAccountId) {
  try {
    const res = await crmFetch(`/Contacts/search?criteria=(Account_Name:equals:${zohoAccountId})`);
    const contacts = res?.data || [];
    if (!contacts.length) return null;
    const owner = contacts.find((c) => c.Portal_Role === 'Owner' || !c.Reporting_To) || contacts[0];
    return {
      zohoContactId: owner.id,
      firstName: owner.First_Name || null,
      lastName: owner.Last_Name || null,
      fullName: owner.Full_Name || [owner.First_Name, owner.Last_Name].filter(Boolean).join(' ') || null,
      email: owner.Email || null,
      phone: owner.Phone || owner.Mobile || null,
    };
  } catch (err) {
    log.warn(`[crm] getPrimaryContactForAccount skipped for ${zohoAccountId}:`, err.message);
    return null;
  }
}

/**
 * Safely find an existing Owner Contact under a specific known CRM Account.
 * Used for idempotent recovery when Account creation succeeded but Contact linkage was interrupted.
 *
 * Rules:
 * 1. Scope search ONLY within the specified zohoAccountId.
 * 2. Match primarily by backendUserId.
 * 3. Fallback: match if exactly one contact has Owner role and matching email/phone.
 * 4. Never attach an arbitrary contact if multiple or ambiguous contacts exist.
 */
export async function findOwnerContactInAccount(zohoAccountId, { backendUserId, email, phone } = {}) {
  if (!zohoAccountId || !crmConfigured()) return null;
  try {
    const res = await crmFetch(`/Contacts/search?criteria=(Account_Name:equals:${zohoAccountId})`);
    const contacts = res?.data || [];
    if (!contacts.length) return null;

    // 1. Primary match: Backend_User_ID
    if (backendUserId) {
      const byUserId = contacts.find((c) => {
        const cUserId = c[FIELDS.contact.backendUserId()] || c.Backend_User_ID;
        return cUserId && String(cUserId) === String(backendUserId);
      });
      if (byUserId) {
        return {
          zohoContactId: byUserId.id,
          matchedBy: 'backend_user_id',
          contact: byUserId,
        };
      }
    }

    // 2. Secondary match: Owner role with matching email or phone
    const norm = phone ? normalizePhone(phone) : null;
    const cleanEmail = email ? normalizeEmail(email) : null;

    const ownerCandidates = contacts.filter((c) => {
      const role = c[FIELDS.contact.portalRole()] || c.Portal_Role;
      const isOwnerRole = role === 'Owner' || !c.Reporting_To;
      if (!isOwnerRole) return false;

      const emailMatches = cleanEmail && normalizeEmail(c.Email) === cleanEmail;
      const phoneMatches = norm?.nationalNumber && (
        c.Phone === norm.nationalNumber ||
        c.Mobile === norm.nationalNumber ||
        String(c.Phone).endsWith(norm.nationalNumber) ||
        String(c.Mobile).endsWith(norm.nationalNumber)
      );

      return emailMatches || phoneMatches;
    });

    if (ownerCandidates.length === 1) {
      return {
        zohoContactId: ownerCandidates[0].id,
        matchedBy: 'owner_identity',
        contact: ownerCandidates[0],
      };
    }

    if (ownerCandidates.length > 1) {
      log.warn(`[crm] Multiple potential owner contacts found under account ${zohoAccountId}`);
      return { ambiguous: true };
    }

    return null;
  } catch (err) {
    log.warn(`[crm] findOwnerContactInAccount failed for account ${zohoAccountId}:`, err.message);
    return null;
  }
}

/**
 * Update the Store Code (api name: Dealer_Code) on both the Account
 * and its associated Contacts in Zoho CRM.
 */
export async function updateDealerCodeInCrm({ zohoAccountId, dealerCode, ownerPhone }) {
  if (!zohoAccountId || !crmConfigured()) return false;
  try {
    const norm = normalizePhone(ownerPhone);
    // 1. Update the Account
    const accPayload = {
      id: String(zohoAccountId),
      ...(dealerCode ? { [FIELDS.account.dealerCode()]: String(dealerCode).trim() } : {}),
      ...(norm.nationalNumber ? { Phone: norm.nationalNumber } : {}),
    };
    await crmFetch('/Accounts', {
      method: 'PUT',
      body: { data: [accPayload] },
    });

    // 2. Find and update Contacts under this Account
    try {
      const contactsRes = await crmFetch(`/Contacts/search?criteria=(Account_Name:equals:${zohoAccountId})`);
      const contacts = contactsRes?.data || [];
      if (contacts.length > 0) {
        const contactUpdates = contacts.map((c) => {
          const isOwner = c.Portal_Role === 'Owner' || !c.Reporting_To;
          return {
            id: c.id,
            ...(dealerCode ? { [FIELDS.account.dealerCode()]: String(dealerCode).trim() } : {}),
            ...(isOwner && norm.nationalNumber ? {
              Phone: norm.nationalNumber,
              Mobile: norm.nationalNumber,
              [FIELDS.contact.countryCode()]: norm.countryCode,
            } : {}),
          };
        });
        await crmFetch('/Contacts', {
          method: 'PUT',
          body: { data: contactUpdates },
        });
      }
    } catch (conErr) {
      log.warn(`[crm] Contact update for account ${zohoAccountId} skipped:`, conErr.message);
    }
    log.info(`[crm] Synced Store Code ${dealerCode || ''} & phone to Account ${zohoAccountId} & Contacts`);
    return true;
  } catch (err) {
    log.error(`[crm] Failed to sync Store Code to CRM:`, err.message);
    return false;
  }
}

/** Deactivate an Account in Zoho CRM by updating Dealer_Status to Revoked (no deletion). */
export async function deactivateAccountInCrm(accountId, status = 'Revoked') {
  if (!accountId || !crmConfigured()) return false;
  try {
    await crmFetch('/Accounts', {
      method: 'PUT',
      body: { data: [{ id: String(accountId), [FIELDS.account.dealerStatus()]: status }] },
    });
    log.info(`[crm] Deactivated Account ${accountId} in Zoho CRM (Dealer_Status: ${status})`);
    return true;
  } catch (err) {
    log.warn(`[crm] Failed to deactivate Account ${accountId}: ${err.message}`);
    return false;
  }
}

/** Deactivate a Contact in Zoho CRM by updating Portal_Role to Inactive (no deletion). */
export async function deactivateContactInCrm(contactId, role = 'Inactive') {
  if (!contactId || !crmConfigured()) return false;
  try {
    await crmFetch('/Contacts', {
      method: 'PUT',
      body: { data: [{ id: String(contactId), [FIELDS.contact.portalRole()]: role }] },
    });
    log.info(`[crm] Deactivated Contact ${contactId} in Zoho CRM (Portal_Role: ${role})`);
    return true;
  } catch (err) {
    log.warn(`[crm] Failed to deactivate Contact ${contactId}: ${err.message}`);
    return false;
  }
}

/** Update verified contact details (phone, email) on an existing CRM Contact. */
export async function updateContactDetails(contactId, { phone, email } = {}) {
  if (!contactId || !crmConfigured()) return false;
  const norm = phone ? normalizePhone(phone) : null;
  const updatePayload = {
    id: String(contactId),
    ...(norm?.nationalNumber ? { Phone: norm.nationalNumber, Mobile: norm.nationalNumber } : {}),
    ...(email ? { Email: normalizeEmail(email) } : {}),
  };
  try {
    await crmFetch('/Contacts', {
      method: 'PUT',
      body: { data: [updatePayload] },
    });
    log.info(`[crm] Successfully updated Contact ${contactId} details`);
    return true;
  } catch (err) {
    log.warn(`[crm] Failed to update Contact ${contactId} details: ${err.message}`);
    return false;
  }
}

export const isCrmConfigured = () => Boolean(crmConfigured());

