import { env } from '../config/env.js';

// Mirrors the token + fetch patterns of api/zoho.js (Zoho Commerce Store API),
// kept standalone so the backend service has no import from the Vercel layer.

let cachedToken = null; // { token, expiresAt }

const commerceConfigured = () =>
  env.zoho.commerce.clientId && env.zoho.commerce.clientSecret && env.zoho.commerce.refreshToken;

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`https://accounts.zoho.${env.zoho.dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.zoho.commerce.clientId,
      client_secret: env.zoho.commerce.clientSecret,
      refresh_token: env.zoho.commerce.refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Commerce token refresh failed: ${data.error || res.status}`);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.token;
}

async function commerceFetch(path) {
  const run = async (token) =>
    fetch(`https://commerce.zoho.${env.zoho.dc}/store/api/v1${path}`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'X-com-zoho-store-organizationid': env.zoho.commerce.orgId,
      },
    });

  let res = await run(await getAccessToken());
  if (res.status === 401) {
    cachedToken = null;
    res = await run(await getAccessToken({ forceRefresh: true }));
  }
  if (!res.ok) throw new Error(`Commerce ${path} failed (${res.status})`);
  return res.json();
}

const parseRate = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** item_id → dealer pricebook_rate */
export async function fetchPricebookRates(pricebookId = env.zoho?.commerce?.dealerPricebookId || null) {
  const data = await commerceFetch(`/pricebooks/${pricebookId}`);
  const items = data?.pricebook?.pricebook_items || [];
  const rates = {};
  for (const item of items) {
    if (item.item_id && typeof item.pricebook_rate === 'number') {
      rates[item.item_id] = item.pricebook_rate;
    }
  }
  return rates;
}

/** Full catalogue: [{ product_id, name, sku, mrp, dealer_rate }] — mrp per label_rate > rate > min_rate. */
export async function fetchCatalog() {
  const dealerRates = await fetchPricebookRates();
  const products = [];
  for (let page = 1; ; page++) {
    const data = await commerceFetch(`/products?page=${page}&per_page=200`);
    const batch = data?.products || [];
    for (const p of batch) {
      if (p.status !== 'active' || p.show_in_storefront === false) {
        continue;
      }
      const name = (p.name ?? p.product_name ?? '').toLowerCase();
      const cat = (p.category_name ?? '').toLowerCase();
      if (
        name.startsWith('scheme ') ||
        name.startsWith('banner ') ||
        name.startsWith('restor banner') ||
        name.startsWith('restor scheme') ||
        cat.includes('banner') ||
        cat.includes('scheme')
      ) {
        continue;
      }
      const variant = p.variants?.[0] || {};
      const mrp = parseRate(variant.label_rate) ?? parseRate(variant.rate) ?? parseRate(variant.min_rate);
      products.push({
        product_id: p.product_id ?? p.id,
        name: p.name ?? p.product_name,
        sku: p.sku ?? null,
        mrp, // null ⇒ zero-price ⇒ "Price on Request"
        dealer_rate: dealerRates[p.product_id ?? p.id] ?? null,
      });
    }
    if (batch.length < 200) break;
  }
  return products;
}

export const isCommerceConfigured = () => Boolean(commerceConfigured());

async function booksFetch(path, { method = 'GET', body } = {}) {
  const run = async (token) =>
    fetch(`https://www.zohoapis.${env.zoho.dc}/books/v3${path}`, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await run(await getAccessToken());
  if (res.status === 401) {
    cachedToken = null;
    res = await run(await getAccessToken({ forceRefresh: true }));
  }
  if (!res.ok) throw new Error(`Books ${path} failed (${res.status})`);
  return res.json();
}

/** Assign a pricebook to a contact in Zoho Books / Commerce by contact_id */
export async function assignPricebookToContact(contactId, pricebookId = env.zoho?.commerce?.dealerPricebookId || null) {
  if (!contactId || !commerceConfigured()) return false;
  try {
    const data = await booksFetch(`/contacts/${contactId}?organization_id=${env.zoho.commerce.orgId}`, {
      method: 'PUT',
      body: { pricebook_id: pricebookId },
    });
    return data.code === 0;
  } catch (err) {
    return false;
  }
}

let cachedPricebooksList = null;
let pricebooksFetchedAt = 0;

/** Fetch all pricebooks live from Zoho Commerce, cached for 10 minutes */
export async function fetchCommercePricebooks({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cachedPricebooksList && now - pricebooksFetchedAt < 10 * 60 * 1000) {
    return cachedPricebooksList;
  }
  try {
    const data = await commerceFetch('/pricebooks');
    const pbs = data?.pricebooks || [];
    cachedPricebooksList = pbs.map((p) => ({
      id: String(p.pricebook_id),
      name: String(p.name || '').trim(),
      status: p.status,
    }));
    pricebooksFetchedAt = now;
    return cachedPricebooksList;
  } catch (err) {
    return cachedPricebooksList || [];
  }
}

/**
 * Dynamically resolves a Price Tier name (e.g. "MH DP May 2026" or newly created price list)
 * to its Zoho Commerce Pricebook ID.
 * If not in cache, immediately fetches fresh pricebooks from Zoho Commerce.
 */
export async function resolvePricebookId(tierOrId) {
  if (!tierOrId) return env.zoho?.commerce?.dealerPricebookId || null;
  const clean = String(tierOrId).trim();
  if (/^\d{10,}$/.test(clean)) return clean; // Already a numeric Zoho ID

  // 1. Check in cached pricebooks list
  let list = await fetchCommercePricebooks();
  let match = list.find((p) => p.name.toLowerCase() === clean.toLowerCase() || p.id === clean);

  // 2. If not found, force fresh fetch from Zoho Commerce API (handles newly created price lists)
  if (!match) {
    list = await fetchCommercePricebooks({ refresh: true });
    match = list.find((p) => p.name.toLowerCase() === clean.toLowerCase() || p.id === clean);
  }

  if (match) return match.id;

  // 3. Fallback to default dealer pricebook
  return env.zoho?.commerce?.dealerPricebookId || null;
}

/**
 * Given a Zoho CRM Account ID, find the synced contact in Zoho Books / Commerce
 * and ensure it has the appropriate dealer pricebook attached (resolved from priceTier or default).
 */
export async function ensureContactPricebookForCrmAccount(crmAccountId, priceTierOrId) {
  if (!crmAccountId || !commerceConfigured()) return false;
  const targetPricebookId = await resolvePricebookId(priceTierOrId);
  try {
    const data = await booksFetch(`/contacts?organization_id=${env.zoho.commerce.orgId}&zcrm_account_id=${crmAccountId}`);
    const contacts = data.contacts || [];
    if (!contacts.length) return false;
    for (const c of contacts) {
      await assignPricebookToContact(c.contact_id, targetPricebookId);
    }
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Delete a synced contact in Zoho Books / Commerce by CRM Contact ID or CRM Account ID.
 */
/** Deactivate contact in Zoho Books/Commerce (no deletion). */
export async function deactivateCommerceContact({ crmContactId, crmAccountId } = {}) {
  if (!commerceConfigured()) return false;
  try {
    const query = crmContactId
      ? `zcrm_contact_id=${crmContactId}`
      : crmAccountId
      ? `zcrm_account_id=${crmAccountId}`
      : null;
    if (!query) return false;

    const data = await booksFetch(`/contacts?organization_id=${env.zoho.commerce.orgId}&${query}`);
    const contacts = data.contacts || [];
    for (const c of contacts) {
      if (c.contact_id) {
        await booksFetch(`/contacts/${c.contact_id}/inactive?organization_id=${env.zoho.commerce.orgId}`, {
          method: 'POST',
        }).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}
export { deactivateCommerceContact as deleteCommerceContact };


