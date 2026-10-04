import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

// Custom-field API names in CRM. These defaults match the fields created in
// docs/BACKEND-ARCHITECTURE.md §1.1 — override via env if Zoho assigns different
// api_names on creation (check in CRM → Setup → Modules → Accounts/Contacts).
const FIELDS = {
  account: {
    gst: () => process.env.ZOHO_CRM_FIELD_GST || 'GST_Number',
    dealerStatus: () => process.env.ZOHO_CRM_FIELD_DEALER_STATUS || 'Dealer_Status',
    dealerCode: () => process.env.ZOHO_CRM_FIELD_DEALER_CODE || 'Dealer_Code',
    priceTier: () => process.env.ZOHO_CRM_FIELD_PRICE_TIER || 'Price_Tier',
  },
  contact: {
    portalRole: () => process.env.ZOHO_CRM_FIELD_PORTAL_ROLE || 'Portal_Role',
    backendUserId: () => process.env.ZOHO_CRM_FIELD_BACKEND_USER_ID || 'Backend_User_ID',
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

async function crmFetch(path, { method = 'GET', body } = {}) {
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
export async function createDealerAccount({ businessName, gstNumber, phone, email, address }) {
  const account = {
    Account_Name: businessName,
    Phone: phone || undefined,
    Email: email || undefined,
    Billing_Street: address || undefined,
    [FIELDS.account.gst()]: gstNumber || undefined,
    [FIELDS.account.dealerStatus()]: 'Pending',
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

/** Create a Contact under the dealer Account. Returns the CRM Contact id. */
export async function createDealerContact({ accountId, personName, phone, email, portalRole = 'Owner' }) {
  const contact = {
    Last_Name: personName || 'Dealer Owner',
    Account_Name: { id: accountId },
    Phone: phone || undefined,
    Email: email || undefined,
    [FIELDS.contact.portalRole()]: portalRole,
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
 * Read a dealer Account from CRM — the source of truth for approval.
 * Returns { zohoAccountId, dealerStatus, dealerCode, priceTier } or null.
 */
export async function getDealerAccount(zohoAccountId) {
  const data = await crmFetch(`/Accounts/${zohoAccountId}`);
  const acc = data?.data?.[0];
  if (!acc) return null;
  return {
    zohoAccountId: acc.id,
    dealerStatus: acc[FIELDS.account.dealerStatus()] || 'Pending',
    dealerCode: acc[FIELDS.account.dealerCode()] || null,
    priceTier: acc[FIELDS.account.priceTier()] || null,
    businessName: acc.Account_Name || null,
  };
}

export const isCrmConfigured = () => Boolean(crmConfigured());
