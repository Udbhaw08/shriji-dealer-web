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
export async function fetchPricebookRates(pricebookId = env.zoho.commerce.dealerPricebookId) {
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
