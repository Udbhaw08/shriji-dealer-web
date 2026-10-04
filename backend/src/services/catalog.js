import { sql } from '../db/pool.js';
import { env } from '../config/env.js';
import { fetchCatalog, isCommerceConfigured } from './commerceClient.js';
import { log } from '../utils/logger.js';

let memory = null; // { products, fetchedAt }

const CACHE_KEY = 'catalog';

/** Pull the full catalogue from Zoho Commerce into DB + memory. Zoho stays master. */
export async function syncCatalog() {
  if (!isCommerceConfigured()) {
    log.warn('[catalog] Commerce not configured — skipping sync');
    return false;
  }
  const products = await fetchCatalog();
  memory = { products, fetchedAt: new Date() };
  await sql`
    insert into catalog_cache (key, data, fetched_at)
    values (${CACHE_KEY}, ${JSON.stringify(products)}, ${memory.fetchedAt})
    on conflict (key) do update set data = excluded.data, fetched_at = excluded.fetched_at`;
  log.info(`[catalog] synced ${products.length} products`);
  return true;
}

async function loadCatalog() {
  const ttlMs = env.catalogTtlMinutes * 60 * 1000;
  if (memory && Date.now() - memory.fetchedAt.getTime() < ttlMs) return memory.products;
  const rows = await sql`select data, fetched_at from catalog_cache where key = ${CACHE_KEY}`;
  if (rows[0]) {
    memory = { products: rows[0].data, fetchedAt: new Date(rows[0].fetched_at) };
    if (Date.now() - memory.fetchedAt.getTime() < ttlMs) return memory.products;
  }
  await syncCatalog();
  return memory?.products || [];
}

/**
 * Pure price view — the role-gating core, unit-tested directly.
 *  - customer / guest / unapproved dealer → mrp only (dealer_rate never leaves)
 *  - active dealer / dealer_staff with an approved dealer → mrp + dealer_rate
 * Zero-price items carry price_on_request: true — a ₹0 never reaches any client.
 */
export function priceView(viewer, products) {
  const dealerOk =
    viewer &&
    (viewer.role === 'dealer' || viewer.role === 'dealer_staff') &&
    viewer.status === 'active';

  return products.map((p) => {
    const base = {
      product_id: p.product_id,
      name: p.name,
      sku: p.sku,
      mrp: p.mrp,
      price_on_request: !(p.mrp && p.mrp > 0),
    };
    // invariant from docs/PRICING-ARCHITECTURE.md: dealer price never exceeds MRP
    const dealerValid = p.mrp > 0 && p.dealer_rate > 0 && p.dealer_rate <= p.mrp;
    if (dealerOk) {
      base.dealer_rate = dealerValid ? p.dealer_rate : null;
    }
    return base;
  });
}

export async function catalogFor(viewer) {
  return priceView(viewer, await loadCatalog());
}
