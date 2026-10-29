import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Load environment variables from .env.local if present (local dev fallback)
function loadEnv() {
  const env = { ...process.env };
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          env[match[1]] = (match[2] || "").trim();
        }
      }
    }
  } catch {}
  return env;
}

let cachedAccessToken = null;
let tokenExpiryTime = 0;
let refreshPromise = null;
let zohoThrottleUntil = 0;

const localCacheFile = path.resolve(process.cwd(), ".token_cache.json");
const tmpCacheFile = path.resolve(os.tmpdir(), "webstore_zoho_token.json");

function readDiskCache() {
  for (const file of [localCacheFile, tmpCacheFile]) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (data.access_token) return data;
      }
    } catch {}
  }
  return null;
}

function writeDiskCache(token, expiry) {
  const payload = JSON.stringify({ access_token: token, expires_at: expiry });
  for (const file of [localCacheFile, tmpCacheFile]) {
    try {
      fs.writeFileSync(file, payload, "utf-8");
    } catch {}
  }
}

function clearDiskCache() {
  for (const file of [localCacheFile, tmpCacheFile]) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {}
  }
}

// ---------------- Product Tag Cache & Sync Registry ---------------- //

const localTagCacheFile = path.resolve(process.cwd(), ".tag_cache.json");
const tmpTagCacheFile = path.resolve(os.tmpdir(), "webstore_zoho_tags.json");

let memoryTagCache = null;
let lastTagSyncTime = 0;
let tagSyncInProgress = null;

export function readTagCache() {
  if (memoryTagCache) return memoryTagCache;
  for (const file of [localTagCacheFile, tmpTagCacheFile]) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (data && typeof data === "object") {
          memoryTagCache = data;
          return memoryTagCache;
        }
      }
    } catch {}
  }
  memoryTagCache = {};
  return memoryTagCache;
}

export function writeTagCache(cache) {
  memoryTagCache = cache;
  const payload = JSON.stringify(cache, null, 2);
  for (const file of [localTagCacheFile, tmpTagCacheFile]) {
    try {
      fs.writeFileSync(file, payload, "utf-8");
    } catch {}
  }
}

export function getCachedProductTags(productId) {
  if (!productId) return [];
  const cache = readTagCache();
  const entry = cache[String(productId)];
  if (!entry) return [];
  if (Array.isArray(entry.tags)) return entry.tags;
  if (Array.isArray(entry)) return entry;
  return [];
}

export function updateCachedProductTags(productId, tags, lastModified = null, name = "") {
  if (!productId) return;
  const cache = readTagCache();
  const cleanTags = (Array.isArray(tags) ? tags : [tags])
    .map((t) => (typeof t === "string" ? t : (t?.tag_name || t?.name || "")).trim())
    .filter(Boolean);

  cache[String(productId)] = {
    tags: cleanTags,
    lastModified: lastModified || cache[String(productId)]?.lastModified || Date.now(),
    name: name || cache[String(productId)]?.name || "",
    updatedAt: Date.now(),
  };
  writeTagCache(cache);
}

// ---------------- Persistent Products & Details Disk Cache ---------------- //

const localProductsCacheFile = path.resolve(process.cwd(), ".products_cache.json");
const tmpProductsCacheFile = path.resolve(os.tmpdir(), "webstore_products_cache.json");

const localDetailCacheFile = path.resolve(process.cwd(), ".product_details_cache.json");
const tmpDetailCacheFile = path.resolve(os.tmpdir(), "webstore_product_details.json");

let zohoRateLimitUntil = 0;

export function readProductsDiskCache() {
  for (const file of [localProductsCacheFile, tmpProductsCacheFile]) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (Array.isArray(data.products) && data.products.length > 0) return data;
        if (Array.isArray(data) && data.length > 0) return { products: data, categories: [] };
      }
    } catch {}
  }
  return null;
}

export function writeProductsDiskCache(products, categories = []) {
  if (!Array.isArray(products) || products.length === 0) return;
  const payload = JSON.stringify({ products, categories, time: Date.now() }, null, 2);
  for (const file of [localProductsCacheFile, tmpProductsCacheFile]) {
    try {
      fs.writeFileSync(file, payload, "utf-8");
    } catch {}
  }
}

export function readProductDetailsDiskCache() {
  for (const file of [localDetailCacheFile, tmpDetailCacheFile]) {
    try {
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        if (data && typeof data === "object") return data;
      }
    } catch {}
  }
  return {};
}

export function writeProductDetailDiskCache(key, product) {
  if (!key || !product) return;
  try {
    const map = readProductDetailsDiskCache();
    map[String(key)] = { product, time: Date.now() };
    const payload = JSON.stringify(map, null, 2);
    for (const file of [localDetailCacheFile, tmpDetailCacheFile]) {
      try {
        fs.writeFileSync(file, payload, "utf-8");
      } catch {}
    }
  } catch {}
}

/**
 * Sync tags for recently modified products in Zoho Commerce.
 * Inspects items ordered by last_modified_time desc, fetches detailed single-item tags
 * for any updated/new items, and persists into .tag_cache.json.
 */
export async function syncRecentProductTags({ limit = 5, force = false } = {}) {
  const now = Date.now();
  if (!force && tagSyncInProgress) return tagSyncInProgress;
  if (!force && now - lastTagSyncTime < 60000) {
    return readTagCache();
  }

  tagSyncInProgress = (async () => {
    try {
      const { dc, orgId } = getZohoConfig();
      const res = await fetchZohoWithRetry(
        `https://commerce.zoho.${dc}/store/api/v1/products?sort_column=last_modified_time&sort_order=D&per_page=${limit}`,
        {
          headers: { "X-com-zoho-store-organizationid": orgId },
        }
      );

      if (!res.ok) {
        return readTagCache();
      }

      const data = await res.json();
      const recentItems = data.products || [];
      const cache = readTagCache();
      let changed = false;

      // Only check the top few items that are new or whose modified time changed
      for (const item of recentItems.slice(0, 5)) {
        const id = String(item.product_id);
        const existing = cache[id];
        const itemModified = item.last_modified_time;

        if (force || !existing || existing.lastModified !== itemModified) {
          try {
            // Polite spacing between single-item Zoho requests
            await new Promise((r) => setTimeout(r, 400));

            const detailRes = await fetchZohoWithRetry(
              `https://commerce.zoho.${dc}/store/api/v1/products/${id}`,
              {
                headers: { "X-com-zoho-store-organizationid": orgId },
              }
            );

            if (detailRes.status === 429) {
              console.warn("[tagSync] Zoho rate limit encountered (429). Pausing sync.");
              break;
            }

            if (!detailRes.ok) continue;

            const d = await detailRes.json();
            if (!d?.product) continue;

            const rawTags = d.product.tags || d.product.entity_tags || [];
            const tags = rawTags
              .map((t) => (typeof t === "string" ? t : (t?.tag_name || t?.name || "")).trim())
              .filter(Boolean);

            cache[id] = {
              tags,
              lastModified: itemModified,
              name: item.name || d.product.name || "",
              updatedAt: Date.now(),
            };
            changed = true;
          } catch (err) {
            console.warn(`[tagSync] failed fetching detail for ${id}:`, err.message);
          }
        }
      }

      if (changed) {
        writeTagCache(cache);
      }
      lastTagSyncTime = Date.now();
      return cache;
    } catch (err) {
      console.warn("[tagSync] failed to sync recent tags:", err.message);
      return readTagCache();
    } finally {
      tagSyncInProgress = null;
    }
  })();

  return tagSyncInProgress;
}

export async function getAccessToken({ forceRefresh = false } = {}) {
  const env = loadEnv();
  const now = Date.now();

  if (!forceRefresh && cachedAccessToken && now < tokenExpiryTime - 60000) {
    return cachedAccessToken;
  }

  // Check on-disk cache
  if (!forceRefresh) {
    const diskData = readDiskCache();
    if (diskData && diskData.access_token && now < diskData.expires_at - 60000) {
      cachedAccessToken = diskData.access_token;
      tokenExpiryTime = diskData.expires_at;
      return cachedAccessToken;
    }
  }

  // If currently within a Zoho OAuth lockout period, fall back to cached token
  if (now < zohoThrottleUntil) {
    const diskData = readDiskCache();
    if (diskData && diskData.access_token) {
      cachedAccessToken = diskData.access_token;
      tokenExpiryTime = diskData.expires_at;
      return cachedAccessToken;
    }
    if (cachedAccessToken) return cachedAccessToken;
  }

  // Deduplicate concurrent token refresh requests (singleflight)
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const dc = env.ZOHO_DC || "in";
      const clientId = env.ZOHO_CLIENT_ID;
      const clientSecret = env.ZOHO_CLIENT_SECRET;
      const refreshToken = env.ZOHO_REFRESH_TOKEN;

      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Zoho credentials in environment / .env.local");
      }

      const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      });

      const data = await res.json();
      if (!data.access_token) {
        const desc = String(data.error_description || data.error || "");
        if (desc.includes("too many requests") || desc.includes("Access Denied")) {
          // Lock out for 5 minutes so we don't hammer Zoho
          zohoThrottleUntil = Date.now() + 5 * 60 * 1000;
        }
        const diskData = readDiskCache();
        if (diskData && diskData.access_token) {
          console.warn("⚠️ Zoho refresh rate limited. Falling back to active token cache.", desc);
          cachedAccessToken = diskData.access_token;
          tokenExpiryTime = diskData.expires_at;
          return cachedAccessToken;
        }
        throw new Error(`Failed to refresh Zoho token: ${data.error || JSON.stringify(data)}${desc ? ` (${desc})` : ""}`);
      }

      cachedAccessToken = data.access_token;
      tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000;
      writeDiskCache(cachedAccessToken, tokenExpiryTime);

      return cachedAccessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Fetch wrapper that automatically catches 401 Unauthorized,
 * requests a fresh OAuth access token, and retries the request once.
 */
export async function fetchZohoWithRetry(url, options = {}) {
  let token = await getAccessToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Zoho-oauthtoken ${token}`,
  };

  let res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !options._retried) {
    try {
      token = await getAccessToken({ forceRefresh: true });
      headers.Authorization = `Zoho-oauthtoken ${token}`;
      res = await fetch(url, { ...options, _retried: true, headers });
    } catch (err) {
      console.warn("Zoho retry failed:", err.message);
    }
  }
  return res;
}

export function getZohoConfig() {
  const env = loadEnv();
  return {
    dc: env.ZOHO_DC || "in",
    orgId: env.ZOHO_ORG_ID || "60061569211",
  };
}

/**
 * Fetch a specific dealer by Zoho contact ID.
 */
export async function getDealerById(contactId) {
  const { dc, orgId } = getZohoConfig();

  const url = `https://www.zohoapis.${dc}/books/v3/contacts/${contactId}?organization_id=${orgId}`;
  const res = await fetchZohoWithRetry(url);
  const data = await res.json();
  if (!data.contact) return null;

  const c = data.contact;
  const rawPhone = c.mobile || c.phone || "";
  let digits = String(rawPhone).replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  const isApproved = c.status === "active" || c.portal_status === "enabled";

  return {
    id: c.contact_id,
    name: c.company_name || c.contact_name,
    person: c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.contact_name,
    phone: rawPhone,
    phoneRaw: digits,
    city: c.billing_address?.city || c.place_of_contact_formatted || c.place_of_contact || "",
    state: c.billing_address?.state || c.shipping_address?.state || c.place_of_contact || "",
    status: isApproved ? "approved" : "pending",
    rawStatus: c.status,
    tier: isApproved ? "Verified Dealer" : "Pending Verification",
    rebatePct: 20,
    pricebookId: c.pricebook_id || "",
    pricebookName: c.pricebook_name || "",
  };
}

/**
 * Create a new dealer application contact in Zoho.
 */
export async function createDealerContact({ shop, person, phone, email, city, gst }) {
  const token = await getAccessToken();
  const { dc, orgId } = getZohoConfig();
  const env = loadEnv();
  const defaultPricebookId = env.ZOHO_DEALER_PRICEBOOK_ID || "3334672000000547177";

  const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);

  // Payload adhering to Zoho Books Contacts specification
  const payload = {
    contact_name: shop ? `${shop} (${person})` : person,
    company_name: shop,
    customer_sub_type: "business",
    contact_type: "customer",
    status: "inactive", // inactive until approved by admin in Zoho
    pricebook_id: defaultPricebookId,
    notes: `Dealer Application from Website Portal\nShop: ${shop}\nPerson: ${person}\nCity: ${city || "N/A"}\nGST: ${gst || "N/A"}`,
    billing_address: {
      city: city || "",
      country: "India",
    },
    contact_persons: [
      {
        first_name: person,
        email: email || "",
        phone: cleanPhone,
        mobile: cleanPhone,
        is_primary_contact: true,
      },
    ],
  };

  if (gst) {
    payload.gst_no = gst.trim().toUpperCase();
    payload.gst_treatment = "business_gst";
  }

  const url = `https://www.zohoapis.${dc}/books/v3/contacts?organization_id=${orgId}`;
  const res = await fetchZohoWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (data.code !== 0 && data.code !== 201) {
    throw new Error(data.message || "Failed to create dealer in Zoho");
  }

  const created = data.contact || {};
  const contactId = created.contact_id;

  // Zoho Books creates all contacts as active by default.
  // Explicitly mark as inactive so they require admin approval to become active dealers!
  if (contactId) {
    try {
      await fetch(`https://www.zohoapis.${dc}/books/v3/contacts/${contactId}/inactive?organization_id=${orgId}`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      });
    } catch (err) {
      console.warn("Could not set contact inactive:", err);
    }
  }

  return {
    id: contactId,
    name: shop,
    person: person,
    phone: cleanPhone,
    status: "pending",
    message: "Application successfully submitted to Zoho! It is placed under review.",
  };
}

// ---------------- Live Zoho Commerce Catalog Fetcher ---------------- //

let cachedRawProducts = null;
let rawProductsCacheTime = 0;
const cachedProductsByPricebook = new Map();
const cachedPricebooks = new Map();
let cachedCategories = null;
let categoriesCacheTime = 0;

export function slugifyProduct(nameOrProduct) {
  if (!nameOrProduct) return "";
  const str = typeof nameOrProduct === "string"
    ? nameOrProduct
    : (nameOrProduct.name || nameOrProduct.model || "");
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugifyCategory(name) {
  if (!name) return "appliances";
  const lower = name.toLowerCase().trim();
  if (lower.includes("stove")) return "gas_stoves";
  if (lower.includes("hob top") || lower.includes("hob_top")) return "hob_tops";
  if (lower.includes("hob")) return "hobs";
  if (lower.includes("chimney")) return "chimneys";
  if (lower.includes("small") || lower.includes("kettle") || lower.includes("cooker")) return "small_appliances";
  if (lower.includes("geyser") || lower.includes("water heater")) return "gas_geysers";
  if (lower.includes("flour") || lower.includes("natraj")) return "natraj_flour_mill";
  if (lower.includes("spare")) return "spares";
  return lower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "appliances";
}

function parseRate(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^\d.]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}


/**
 * Fetch all available pricebooks live from Zoho Commerce Store API:
 * GET https://commerce.zoho.in/store/api/v1/pricebooks
 */
export async function fetchZohoPricebooks({ refresh = false } = {}) {
  const { dc, orgId } = getZohoConfig();
  const url = `https://commerce.zoho.${dc}/store/api/v1/pricebooks`;
  const res = await fetchZohoWithRetry(url, {
    headers: { "X-com-zoho-store-organizationid": orgId },
  });
  const data = await res.json();
  return data.pricebooks || [];
}

export async function resolvePricebookId(tierOrId) {
  if (!tierOrId) return "3334672000000547177";
  const clean = String(tierOrId).trim();
  if (/^\d{10,}$/.test(clean)) return clean;
  try {
    const pbs = await fetchZohoPricebooks();
    const match = pbs.find(
      (p) =>
        String(p.name || "").toLowerCase() === clean.toLowerCase() ||
        String(p.pricebook_id) === clean
    );
    if (match) return String(match.pricebook_id);
  } catch {}
  return "3334672000000547177";
}

/**
 * Fetch all item wholesale rates live from a Zoho Commerce Pricebook:
 * GET https://commerce.zoho.in/store/api/v1/pricebooks/{pricebook_id}
 */
export async function fetchZohoPricebookItems(pricebookId = "3334672000000547177", { refresh = false } = {}) {
  const resolvedId = await resolvePricebookId(pricebookId);
  const pbId = String(resolvedId || "3334672000000547177").trim();
  const now = Date.now();
  const cached = cachedPricebooks.get(pbId);
  if (!refresh && cached && now - cached.time < 60000) {
    return cached.rates;
  }

  const { dc, orgId } = getZohoConfig();
  const url = `https://commerce.zoho.${dc}/store/api/v1/pricebooks/${pbId}`;
  const res = await fetchZohoWithRetry(url, {
    headers: { "X-com-zoho-store-organizationid": orgId },
  });

  const data = await res.json();
  const items = data.pricebook?.pricebook_items || [];
  const rateMap = {};
  for (const item of items) {
    if (item.item_id && typeof item.pricebook_rate === "number") {
      rateMap[item.item_id] = item.pricebook_rate;
    }
  }

  cachedPricebooks.set(pbId, { rates: rateMap, time: now });
  return rateMap;
}
/**
 * Fetches pricebook rates with automatic fallback to Mumbai PL Oct 2026 (3334672000000547177).
 * Strictly guarantees that custom assigned rates take priority, while uncustomized items
 * fall back to the default Mumbai price list rather than arbitrary formula discounts.
 */
export async function fetchResolvedPricebookRates(pricebookId = "3334672000000547177", { refresh = false } = {}) {
  const resolvedId = await resolvePricebookId(pricebookId);
  const pbId = String(resolvedId || "3334672000000547177").trim();
  const defaultPbId = "3334672000000547177";

  if (pbId === defaultPbId) {
    return fetchZohoPricebookItems(defaultPbId, { refresh });
  }

  const [customRates, defaultRates] = await Promise.all([
    fetchZohoPricebookItems(pbId, { refresh }),
    fetchZohoPricebookItems(defaultPbId, { refresh }),
  ]);

  return { ...defaultRates, ...customRates };
}


const cachedProductDetails = new Map();

function normalizeProduct(p, livePricebookRates = {}) {
  const variant = p.variants?.[0] || {};
  const docs = p.documents?.length ? p.documents : (variant.documents || []);
  const primaryDoc = docs[0] || (p.document_id && p.document_name ? { file_name: p.document_name, document_id: p.document_id } : null);

  const cdnBase = "https://cdn2.zohoecommerce.com/product-images/";
  const domainParam = "?storefront_domain=www.shrijidomestic.com";

  const buildDocUrl = (d) => {
    if (!d || !d.file_name) return "";
    if (d.document_id) {
      return `${cdnBase}${encodeURIComponent(d.file_name)}/${d.document_id}/600x600${domainParam}`;
    }
    return `${cdnBase}${encodeURIComponent(d.file_name)}${domainParam}`;
  };

  const img = buildDocUrl(primaryDoc);
  const images = docs.map(buildDocUrl).filter(Boolean);

  const catName = p.category_name || p.category?.category_name || "Appliances";
  const catKey = slugifyCategory(catName);

  // Extract size (e.g. 60 cm, 90 cm)
  const sizeMatch = p.name.match(/(\d+)\s*(?:cm|CM)/);
  const size = sizeMatch ? `${sizeMatch[1]} cm` : "";

  // Extract burners (e.g. 2B, 3B, 4 Burner)
  const burnerMatch = p.name.match(/(\d+)\s*(?:B\b|Burner)/i);
  const burners = burnerMatch ? Number(burnerMatch[1]) : null;

  // Extract finish
  let finish = "Standard";
  let fkey = "steel";
  const lowerName = p.name.toLowerCase();
  if (lowerName.includes("glass")) {
    finish = "Toughened Glass";
    fkey = "glass";
  } else if (lowerName.includes("steel") || lowerName.includes("ss")) {
    finish = "Stainless Steel";
    fkey = "steel";
  } else if (lowerName.includes("black")) {
    finish = "Black Finish";
    fkey = "glass";
  }

  // Extract features
  const features = [];
  const isGasCategory = catKey === "gas_stoves" || catKey === "hobs" || catKey === "hob_tops" || catKey === "commercial_burners";
  const hasGasKeyword = lowerName.includes("gas") || lowerName.includes("stove") || lowerName.includes("burner") || lowerName.includes("hob");
  if (lowerName.includes("bldc")) features.push("BLDC Motor");
  if ((lowerName.includes("auto") || lowerName.includes("ignition")) && (isGasCategory || hasGasKeyword)) {
    features.push("Auto Ignition");
  } else if (lowerName.includes("auto cut") || lowerName.includes("cut-off") || lowerName.includes("cut off") || catKey === "small_appliances") {
    features.push("Auto Cut-Off");
  } else if (lowerName.includes("auto clean") || lowerName.includes("autoclean")) {
    features.push("Auto Clean");
  }
  if (lowerName.includes("spill")) features.push("Spill Proof");
  if (lowerName.includes("flame")) features.push("Flame Failure Device");

  const labelRate = parseRate(variant.label_rate);
  const sellingRate = parseRate(variant.rate);
  const minRate = parseRate(p.min_rate);
  const purchaseRate = parseRate(variant.purchase_rate);

  // Customer retail price (MRP) directly from Zoho Commerce API
  const mrp = labelRate > 0 ? labelRate : (sellingRate > 0 ? sellingRate : (minRate > 0 ? minRate : 0));
  const sellingPrice = sellingRate > 0 ? sellingRate : (labelRate > 0 ? labelRate : (minRate > 0 ? minRate : 0));

  // Product Name: Short description is the user's primary name as requested
  const rawShortDesc = (p.product_short_description || "").trim();
  const isJunkShortDesc = !rawShortDesc || rawShortDesc.toLowerCase() === "test" || rawShortDesc.toLowerCase() === "null";
  const name = isJunkShortDesc ? p.name : rawShortDesc;
  const model = name;
  const zohoTitle = p.name || "";

  // Extract custom fields: merge both product level (p.custom_fields) and variant level (variant.custom_fields)
  const pCustomFields = Array.isArray(p.custom_fields) ? p.custom_fields : [];
  const vCustomFields = Array.isArray(variant.custom_fields) ? variant.custom_fields : [];
  const customFieldsMap = new Map();
  for (const cf of pCustomFields) {
    const key = (cf.api_name || cf.label || "").toLowerCase().trim();
    if (key) customFieldsMap.set(key, cf);
  }
  for (const cf of vCustomFields) {
    const key = (cf.api_name || cf.label || "").toLowerCase().trim();
    if (key && (cf.value || cf.value_formatted)) customFieldsMap.set(key, cf);
  }
  const rawCustomFields = Array.from(customFieldsMap.values());

  // 1. Tile Icons (Dynamic: 1..8, only includes non-empty image/text)
  const tileIcons = [];
  for (let i = 1; i <= 8; i++) {
    const imgField = rawCustomFields.find(
      (c) => c.api_name === `cf_tile_icon_image_${i}` || c.label?.toLowerCase() === `tile icon image ${i}`
    );
    const textField = rawCustomFields.find(
      (c) => c.api_name === `cf_tile_icon_text_${i}` || c.label?.toLowerCase() === `tile icon text ${i}`
    );

    if (imgField || textField) {
      const imgFileName = (imgField?.value_formatted || imgField?.file_name || "").trim();
      const imgDocId = (imgField?.value || imgField?.document_id || "").trim();
      let imgUrl = "";
      if (imgFileName && imgDocId) {
        imgUrl = buildDocUrl({ file_name: imgFileName, document_id: imgDocId });
      } else if (imgField?.value && String(imgField.value).startsWith("http")) {
        imgUrl = imgField.value;
      }
      const text = (textField?.value || textField?.value_formatted || "").trim();

      // Only include tile if image or text exists and not a placeholder
      const lowerText = text.toLowerCase();
      if ((imgUrl || text) && lowerText !== "test" && lowerText !== "null") {
        const rawLabel = (textField?.label || "").trim();
        const isPlaceholderLabel =
          !rawLabel ||
          /^tile\s*icon\s*text\s*\d*$/i.test(rawLabel) ||
          /^feature\s*\d*$/i.test(rawLabel);
        let cleanTileText = text;
        if (cleanTileText.toLowerCase().includes("ignition") && !isGasCategory && !hasGasKeyword) {
          cleanTileText = "Auto Cut-Off";
        }
        tileIcons.push({
          index: i,
          image: imgUrl,
          text: cleanTileText,
          label: isPlaceholderLabel ? "" : rawLabel,
        });
      }
    }
  }

  // 2. Named & dynamic custom fields
  const getCfValue = (fieldKey) => {
    const normKey = fieldKey.toLowerCase().replace(/^cf_/, "").replace(/\s+/g, "_");
    const f = rawCustomFields.find((c) => {
      const apiName = (c.api_name || "").toLowerCase().replace(/^cf_/, "").replace(/\s+/g, "_");
      const label = (c.label || "").toLowerCase().replace(/^cf_/, "").replace(/\s+/g, "_");
      return apiName === normKey || label === normKey;
    });
    const val = (f?.value_formatted || f?.value || "").trim();
    if (val && val.toLowerCase() !== "null" && val.toLowerCase() !== "undefined") return val;
    const direct = p[fieldKey] || p[`cf_${normKey}`] || p[normKey] || variant[fieldKey] || variant[`cf_${normKey}`] || "";
    return typeof direct === "string" ? direct.trim() : "";
  };

  const warranty = getCfValue("cf_warranty") || getCfValue("warranty");
  const keyFeatures = getCfValue("cf_key_features") || getCfValue("key features");
  const overview =
    getCfValue("cf_overview") ||
    getCfValue("overview") ||
    getCfValue("cf_product_overview") ||
    getCfValue("product_overview") ||
    getCfValue("cf_description");

  // Dynamic extra custom fields from Zoho
  const extraFields = [];
  for (const cf of rawCustomFields) {
    const apiName = (cf.api_name || "").toLowerCase();
    const label = (cf.label || cf.api_name || "").trim();
    const lowerLabel = label.toLowerCase();
    if (
      apiName.startsWith("cf_tile_icon_") ||
      lowerLabel.startsWith("tile icon ") ||
      apiName === "cf_warranty" || lowerLabel === "warranty" ||
      apiName === "cf_key_features" || lowerLabel === "key features" ||
      apiName === "cf_overview" || lowerLabel === "overview"
    ) {
      continue;
    }
    const val = (cf.value_formatted || cf.value || "").trim();
    const lowerVal = val.toLowerCase();
    if (val && lowerVal !== "null" && lowerVal !== "undefined" && lowerVal !== "test") {
      extraFields.push({ label, value: val, key: cf.api_name || label });
    }
  }

  // 3. Specifications (grouped by specification_group_name)
  const rawSpecs = (Array.isArray(p.specifications) && p.specifications.length > 0)
    ? p.specifications
    : (Array.isArray(p.product_specifications) && p.product_specifications.length > 0
      ? p.product_specifications
      : (Array.isArray(variant.specifications) ? variant.specifications : (Array.isArray(variant.product_specifications) ? variant.product_specifications : [])));
  const specifications = rawSpecs
    .filter((s) => s && (s.name || s.specification_name || s.specification_value || s.value))
    .map((s) => ({
      group: s.specification_group_name || s.group || "General",
      name: s.specification_name || s.name || "",
      value: s.specification_value || s.value || "",
    }))
    .filter((s) => s.name && s.value);

  // 4. Description & Embedded Videos
  const stripHtmlToText = (html) => {
    if (!html || typeof html !== "string") return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
  };

  const rawDesc = (p.description || "").trim();
  const productDesc = (p.product_description || "").trim();
  const cleanRawDesc = stripHtmlToText(rawDesc) ? rawDesc : "";
  const cleanProductDesc = stripHtmlToText(productDesc) ? productDesc : "";
  const description = cleanRawDesc || cleanProductDesc || "";

  const videos = [];

  // Extract explicit video custom fields or variant attributes
  const rawVideoFields = [
    getCfValue("cf_video_url"),
    getCfValue("video_url"),
    getCfValue("cf_youtube_url"),
    getCfValue("youtube_url"),
    getCfValue("cf_video"),
    getCfValue("video"),
    p.video_url,
    variant.video_url,
  ].filter(Boolean);

  for (const v of rawVideoFields) {
    if (typeof v === "string" && v.trim() && !videos.includes(v.trim())) {
      videos.push(v.trim());
    }
  }

  const iframeRegex = /(?:src=["']|href=["']|\b)(https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_?&=%-]+)/gi;
  const combinedContent = `${productDesc} ${rawDesc}`;
  let vMatch;
  while ((vMatch = iframeRegex.exec(combinedContent)) !== null) {
    let vUrl = vMatch[1];
    if (vUrl.includes("watch?v=")) {
      const vId = vUrl.split("watch?v=")[1]?.split("&")[0];
      if (vId) vUrl = `https://www.youtube.com/embed/${vId}`;
    } else if (vUrl.includes("youtu.be/")) {
      const vId = vUrl.split("youtu.be/")[1]?.split("?")[0];
      if (vId) vUrl = `https://www.youtube.com/embed/${vId}`;
    }
    if (vUrl && !videos.includes(vUrl)) videos.push(vUrl);
  }

  // Live dealer rate directly from Zoho Commerce Pricebook API
  const dealerRate = livePricebookRates[p.product_id] ?? null;

  return {
    id: p.product_id,
    slug: slugifyProduct(name) || slugifyProduct(p.name),
    name,
    model,
    zohoTitle,
    shortDescription: rawShortDesc,
    size,
    burners,
    finish,
    fkey,
    features,
    brand: p.brand || "Sunshine",
    tags: (Array.isArray(p.tags) && p.tags.length > 0
      ? p.tags
      : (Array.isArray(p.entity_tags) && p.entity_tags.length > 0
        ? p.entity_tags
        : (Array.isArray(p.product_tags) && p.product_tags.length > 0
          ? p.product_tags
          : (p.tag ? [p.tag] : (getCachedProductTags(p.product_id) || [])))))
      .map((t) => (typeof t === "string" ? t : (t?.tag_name || t?.name || "")).trim())
      .filter(Boolean),
    cat: catKey,
    catLabel: catName,
    code: catKey.substring(0, 2).toUpperCase(),
    mrp,
    sellingPrice,
    labelPrice: labelRate,
    dealerRate,
    stock: p.overall_stock ?? variant.stock_on_hand ?? 0,
    img,
    images: images.length ? images : (img ? [img] : []),
    description,
    productDescriptionHtml: cleanProductDesc,
    overview,
    tileIcons,
    customFields: {
      warranty,
      keyFeatures,
      overview,
    },
    extraFields,
    specifications,
    videos,
    status: p.status || "active",
    showInStore: p.show_in_storefront ?? true,
  };
}

let cachedRawCategories = null;
let rawCategoriesCacheTime = 0;

export async function fetchZohoRawCategories({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cachedRawCategories && now - rawCategoriesCacheTime < 15000) {
    return cachedRawCategories;
  }

  const { dc, orgId } = getZohoConfig();
  const res = await fetchZohoWithRetry(`https://commerce.zoho.${dc}/store/api/v1/categories`, {
    headers: {
      "X-com-zoho-store-organizationid": orgId,
    },
  });

  const data = await res.json();
  const rawList = data.categories || [];
  cachedRawCategories = rawList;
  rawCategoriesCacheTime = now;
  return rawList;
}

export async function getCategoryVisibilityMap({ refresh = false } = {}) {
  const rawCategories = await fetchZohoRawCategories({ refresh });
  const map = new Map();
  const categoryByName = new Map();

  for (const c of rawCategories) {
    const isOnline = c.visibility !== false && c.status !== "inactive";
    map.set(String(c.category_id), isOnline);
    if (c.name) {
      categoryByName.set(c.name.trim().toLowerCase(), c);
    }
  }

  return { map, categoryByName, rawCategories };
}

export function isItemCategoryOnline(item, categoryMap, categoryByName) {
  if (!item) return false;
  const catId = item.category_id || item.category?.category_id;
  if (catId && categoryMap?.has(String(catId))) {
    return categoryMap.get(String(catId)) === true;
  }
  const catName = (item.category_name || item.category?.category_name || "").trim().toLowerCase();
  if (catName && categoryByName?.has(catName)) {
    const cat = categoryByName.get(catName);
    return cat.visibility !== false && cat.status !== "inactive";
  }
  return true;
}

export function isItemOnline(item, categoryMap = null, categoryByName = null) {
  if (!item) return false;
  // 1. Status must be active (not inactive / draft / deleted)
  if (item.status && item.status !== "active") return false;
  // 2. Must be enabled for online storefront ("Show in Online Store" toggle)
  if (item.show_in_storefront === false) return false;
  // 3. Category must be online (not hidden / offline in Zoho)
  if (categoryMap && !isItemCategoryOnline(item, categoryMap, categoryByName)) {
    return false;
  }
  return true;
}

export async function fetchZohoCategories({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cachedCategories && now - categoriesCacheTime < 15000) {
    return cachedCategories;
  }

  const { rawCategories } = await getCategoryVisibilityMap({ refresh });

  const categories = rawCategories
    .filter(
      (c) =>
        c.category_id !== "-1" &&
        c.url !== "rootcategory" &&
        c.name !== "ROOT" &&
        c.name !== "Adjustments" &&
        c.name?.trim().toLowerCase() !== "all products" &&
        c.url !== "all-products" &&
        !/banner|hero|scheme|schema|logo|branding/i.test(c.name || "") &&
        c.visibility !== false && // Exclude offline categories
        c.status !== "inactive" &&
        c.has_active_items !== false
    )
    .map((c) => {
      const slug = slugifyCategory(c.name);
      const doc = Array.isArray(c.documents) && c.documents.length > 0 ? c.documents[0] : null;
      let img = null;
      if (doc?.file_name && doc?.document_id) {
        img = `https://cdn2.zohoecommerce.com/product-images/${encodeURIComponent(doc.file_name)}/${doc.document_id}/600x600?storefront_domain=www.shrijidomestic.com`;
      } else {
        img = slug === "gas_geysers" ? "/img/cat-gas_stoves.webp" : `/img/cat-${slug}.webp`;
      }

      return {
        id: c.category_id,
        key: slug,
        label: c.name,
        code: slug.substring(0, 2).toUpperCase(),
        img,
        document_id: doc?.document_id || null,
        file_name: doc?.file_name || null,
      };
    });

  const PREFERRED_ORDER = ["hob_tops", "gas_stoves", "hobs", "chimneys", "small_appliances"];
  categories.sort((a, b) => {
    const ai = PREFERRED_ORDER.indexOf(a.key);
    const bi = PREFERRED_ORDER.indexOf(b.key);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });

  cachedCategories = categories;
  categoriesCacheTime = now;
  return categories;
}

export function isBannerItem(item) {
  if (!item) return false;
  const name = (item.name || "").toLowerCase().trim();
  const cat = (item.category_name || item.category?.category_name || "").toLowerCase().trim();
  return (
    cat.includes("banner") ||
    cat.includes("hero") ||
    name.includes("banner") ||
    name.includes("hero slide") ||
    name.startsWith("banner")
  );
}

export function isSchemeItem(item) {
  if (!item) return false;
  const name = (item.name || "").toLowerCase().trim();
  const cat = (item.category_name || item.category?.category_name || "").toLowerCase().trim();
  return (
    cat.includes("scheme") ||
    cat.includes("schema") ||
    name.includes("scheme") ||
    name.includes("schema")
  );
}

export function isLogoItem(item) {
  if (!item) return false;
  const name = (item.name || "").toLowerCase().trim();
  const cat = (item.category_name || item.category?.category_name || "").toLowerCase().trim();
  return (
    cat.includes("logo") ||
    cat.includes("branding") ||
    name.includes("logo") ||
    name.includes("brand asset")
  );
}

export const DEFAULT_STORE_BANNERS = [];

export const DEFAULT_SCHEMES = {
  active: [],
  upcoming: [],
  past: [],
};

let cachedAllRawProducts = null;
let allRawProductsCacheTime = 0;

export async function fetchAllRawZohoProducts({ refresh = false } = {}) {
  const now = Date.now();
  // 10-minute memory cache to stay well within Zoho's 5,000 requests/day limit
  if (!refresh && cachedAllRawProducts && cachedAllRawProducts.length > 0 && now - allRawProductsCacheTime < 600000) {
    return cachedAllRawProducts;
  }

  // If Zoho is currently in 429 rate limit cooldown, serve from memory or disk cache
  if (now < zohoRateLimitUntil) {
    if (cachedAllRawProducts && cachedAllRawProducts.length > 0) return cachedAllRawProducts;
    const disk = readProductsDiskCache();
    if (disk?.products?.length) {
      cachedAllRawProducts = disk.products;
      allRawProductsCacheTime = now;
      return cachedAllRawProducts;
    }
  }

  const { dc, orgId } = getZohoConfig();
  const allProducts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://commerce.zoho.${dc}/store/api/v1/products?page=${page}&per_page=200`;
    const res = await fetchZohoWithRetry(url, {
      headers: {
        "X-com-zoho-store-organizationid": orgId,
      },
    });

    if (res.status === 429) {
      console.warn("⚠️ Zoho Commerce API 429 limit exceeded. Activating 15-minute rate limit cooldown.");
      zohoRateLimitUntil = Date.now() + 15 * 60 * 1000;
      break;
    }

    if (!res.ok) {
      break;
    }

    const data = await res.json();
    const batch = data.products || [];
    allProducts.push(...batch);

    hasMore = Boolean(data.page_context?.has_more_page);
    page += 1;
    if (page > 10) break; // safety break
  }

  if (allProducts.length > 0) {
    cachedAllRawProducts = allProducts;
    allRawProductsCacheTime = now;
    // Background sync tags for recently modified products
    syncRecentProductTags({ force: refresh }).catch(() => {});
    return allProducts;
  }

  // If live call returned nothing (e.g. 429 or network issue), PRESERVE existing cache or disk cache!
  if (cachedAllRawProducts && cachedAllRawProducts.length > 0) {
    return cachedAllRawProducts;
  }

  const disk = readProductsDiskCache();
  if (disk?.products?.length) {
    cachedAllRawProducts = disk.products;
    allRawProductsCacheTime = now;
    return cachedAllRawProducts;
  }

  return [];
}

/**
 * Promotional Banners: Served directly from Supabase Store Content Manager.
 * No hardcoded or Zoho banners are served, ensuring zero millisecond flicker.
 */
export async function fetchZohoBanners() {
  try {
    const { getSupabaseBanners } = await import("../../backend/src/services/content.js");
    return await getSupabaseBanners();
  } catch {
    return [];
  }
}

/**
 * Promotional Schemes: Served directly from Supabase Store Content Manager.
 * No hardcoded or Zoho schemes are served, ensuring zero millisecond flicker.
 */
export async function fetchZohoSchemes() {
  try {
    const { getSupabaseSchemes } = await import("../../backend/src/services/content.js");
    return await getSupabaseSchemes();
  } catch {
    return { active: [], upcoming: [], past: [] };
  }
}

export async function fetchZohoProducts({ refresh = false, pricebookId = "3334672000000547177" } = {}) {
  const resolvedId = await resolvePricebookId(pricebookId);
  const pbId = String(resolvedId || "3334672000000547177").trim();
  const now = Date.now();

  const cachedEntry = cachedProductsByPricebook.get(pbId);
  if (!refresh && cachedEntry && cachedEntry.products?.length > 0 && now - cachedEntry.time < 120000) {
    return cachedEntry.products;
  }

  // 1. Fetch raw products and category visibility map in parallel
  const [{ map: categoryMap, categoryByName }, allProducts, livePricebookRates] = await Promise.all([
    getCategoryVisibilityMap({ refresh }),
    fetchAllRawZohoProducts({ refresh }),
    fetchZohoPricebookItems(pbId, { refresh }),
  ]);

  if (!allProducts || allProducts.length === 0) {
    if (cachedEntry && cachedEntry.products?.length > 0) return cachedEntry.products;
    const disk = readProductsDiskCache();
    if (disk?.products?.length) {
      cachedProductsByPricebook.set(pbId, { products: disk.products, time: now });
      return disk.products;
    }
  }

  // 2. Filter active, visible products belonging to online categories (strictly excluding banners, schemes & logos)
  const activeProducts = allProducts.filter(
    (p) => !isBannerItem(p) && !isSchemeItem(p) && !isLogoItem(p) && isItemOnline(p, categoryMap, categoryByName)
  );

  const listToNormalize = activeProducts.length > 0 ? activeProducts : allProducts;

  // 3. Normalize products with this specific pricebook's wholesale rates
  const detailCache = readProductDetailsDiskCache();
  const normalized = listToNormalize.map((p) => {
    let item;
    if (p.slug && p.cat && p.mrp !== undefined) {
      const rate = livePricebookRates[p.id] ?? p.dealerRate;
      item = { ...p, dealerRate: rate };
    } else {
      item = normalizeProduct(p, livePricebookRates);
    }
    const cachedDetail = detailCache[item.id]?.product || detailCache[item.slug]?.product;
    if (cachedDetail) {
      if (cachedDetail.tileIcons?.length && (!item.tileIcons || item.tileIcons.length === 0)) {
        item.tileIcons = cachedDetail.tileIcons;
      }
      if (cachedDetail.specifications?.length && (!item.specifications || item.specifications.length === 0)) {
        item.specifications = cachedDetail.specifications;
      }
      if (cachedDetail.overview && !item.overview) {
        item.overview = cachedDetail.overview;
      }
      if (cachedDetail.videos?.length && (!item.videos || item.videos.length === 0)) {
        item.videos = cachedDetail.videos;
      }
      if (cachedDetail.customFields && (!item.customFields || (!item.customFields.warranty && !item.customFields.keyFeatures))) {
        item.customFields = { ...item.customFields, ...cachedDetail.customFields };
      }
      if (cachedDetail.extraFields?.length && (!item.extraFields || item.extraFields.length === 0)) {
        item.extraFields = cachedDetail.extraFields;
      }
    }
    return item;
  });

  if (normalized.length > 0) {
    cachedProductsByPricebook.set(pbId, { products: normalized, time: now });
    writeProductsDiskCache(normalized, cachedCategories || []);
  }

  return normalized;
}

export async function fetchZohoProductById(identifier, { refresh = false, pricebookId = "3334672000000547177" } = {}) {
  if (!identifier) return null;
  const resolvedId = await resolvePricebookId(pricebookId);
  const pbId = String(resolvedId || "3334672000000547177").trim();
  const clean = String(identifier).trim();
  const now = Date.now();

  let targetId = clean;
  const isNumericId = /^\d+$/.test(clean);
  const slugifiedClean = slugifyProduct(clean);

  const isCompleteProduct = (p) => {
    if (!p) return false;
    const hasSpecs = Array.isArray(p.specifications) && p.specifications.length > 0;
    const hasOverview = Boolean(p.overview || p.customFields?.overview);
    const hasVideos = Array.isArray(p.videos) && p.videos.length > 0;
    return hasSpecs || hasOverview || hasVideos;
  };

  // 1. Check persistent details disk cache first (instant response if complete)
  const diskDetails = readProductDetailsDiskCache();
  if (!refresh && (diskDetails[clean]?.product || (slugifiedClean && diskDetails[slugifiedClean]?.product))) {
    const cachedProd = diskDetails[clean]?.product || diskDetails[slugifiedClean]?.product;
    if (isCompleteProduct(cachedProd)) {
      const liveRates = await fetchResolvedPricebookRates(pbId, { refresh });
      const targetKey = cachedProd.id || clean;
      const resolvedRate = liveRates[targetKey] ?? null;
      return { ...cachedProd, dealerRate: resolvedRate };
    }
  }

  // 2. Find matching product in catalog
  const all = await fetchZohoProducts({ refresh, pricebookId: pbId });
  const match = all.find(
    (p) =>
      p.id === clean ||
      p.slug === clean ||
      p.slug === slugifiedClean ||
      slugifyProduct(p.name) === clean ||
      slugifyProduct(p.name) === slugifiedClean ||
      slugifyProduct(p.model) === clean ||
      slugifyProduct(p.model) === slugifiedClean ||
      slugifyProduct(p.zohoTitle) === clean ||
      slugifyProduct(p.zohoTitle) === slugifiedClean ||
      (p.name && p.name.toLowerCase() === clean.toLowerCase())
  );

  if (match) {
    targetId = match.id;
  } else if (!isNumericId) {
    return null;
  }

  // 3. Check memory & disk detail cache for targetId
  const detailCacheKey = `${targetId}:${pbId}`;
  if (refresh) cachedProductDetails.delete(detailCacheKey);
  const cachedDetail = cachedProductDetails.get(detailCacheKey);
  if (!refresh && cachedDetail && now - cachedDetail.time < 600000 && isCompleteProduct(cachedDetail.product)) {
    return cachedDetail.product;
  }
  if (!refresh && diskDetails[targetId]?.product && isCompleteProduct(diskDetails[targetId].product)) {
    const cachedProd = diskDetails[targetId].product;
    const liveRates = await fetchResolvedPricebookRates(pbId, { refresh });
    const resolvedRate = liveRates[targetId] ?? null;
    return { ...cachedProd, dealerRate: resolvedRate };
  }

  // 4. If currently rate-limited by Zoho, return catalog match instead of failing
  if (now < zohoRateLimitUntil && match) {
    return match;
  }

  const { dc, orgId } = getZohoConfig();

  try {
    const [{ map: categoryMap, categoryByName }, res, livePricebookRates] = await Promise.all([
      getCategoryVisibilityMap(),
      fetchZohoWithRetry(`https://commerce.zoho.${dc}/store/api/v1/products/${targetId}`, {
        headers: {
          "X-com-zoho-store-organizationid": orgId,
        },
      }),
      fetchResolvedPricebookRates(pbId, { refresh }),
    ]);

    if (res.status === 429) {
      console.warn("⚠️ Zoho Commerce API 429 limit during product detail fetch. Returning catalog match.");
      zohoRateLimitUntil = Date.now() + 15 * 60 * 1000;
      return match || null;
    }

    if (!res.ok) {
      return match || null;
    }

    const data = await res.json();
    if (!data.product) return match || null;

    // Enforce item online status and category visibility
    if (!isItemOnline(data.product, categoryMap, categoryByName)) {
      return null;
    }

    const product = normalizeProduct(data.product, livePricebookRates);
    if (product.tags?.length) {
      updateCachedProductTags(targetId, product.tags, data.product.last_modified_time, product.name);
    }
    cachedProductDetails.set(detailCacheKey, { product, time: now });
    writeProductDetailDiskCache(targetId, product);
    writeProductDetailDiskCache(product.slug, product);
    return product;
  } catch (err) {
    console.warn(`[fetchZohoProductById] Network/parse error for ${targetId}:`, err.message);
    return match || null;
  }
}

/**
 * Background pooling worker to progressively fetch & cache full product details
 * (specifications, overview, video embed links, custom fields) from Zoho Commerce.
 * Paces requests with delays to respect Zoho API rate limits.
 */
export async function syncProductDetailsPool({ batchSize = 10, force = false, delayMs = 250 } = {}) {
  const all = await fetchAllRawZohoProducts();
  const diskDetails = readProductDetailsDiskCache();

  const isCompleteProduct = (p) => {
    if (!p) return false;
    const hasSpecs = Array.isArray(p.specifications) && p.specifications.length > 0;
    const hasOverview = Boolean(p.overview || p.customFields?.overview);
    const hasVideos = Array.isArray(p.videos) && p.videos.length > 0;
    return hasSpecs || hasOverview || hasVideos;
  };

  const candidates = all.filter((p) => {
    const id = p.product_id || p.id;
    if (force) return true;
    const existing = diskDetails[id]?.product;
    return !existing || !isCompleteProduct(existing);
  });

  const batch = candidates.slice(0, batchSize);
  if (batch.length === 0) {
    return { synced: 0, total: all.length, remaining: 0 };
  }

  const { dc, orgId } = getZohoConfig();
  const livePricebookRates = await fetchResolvedPricebookRates("3334672000000547177");
  let synced = 0;

  for (const item of batch) {
    const id = item.product_id || item.id;
    try {
      const res = await fetchZohoWithRetry(`https://commerce.zoho.${dc}/store/api/v1/products/${id}`, {
        headers: { "X-com-zoho-store-organizationid": orgId },
      });
      if (res.status === 429) {
        console.warn("[syncProductDetailsPool] Zoho API 429 rate limit exceeded. Pausing pool.");
        zohoRateLimitUntil = Date.now() + 15 * 60 * 1000;
        break;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          const normalized = normalizeProduct(data.product, livePricebookRates);
          writeProductDetailDiskCache(id, normalized);
          if (normalized.slug) writeProductDetailDiskCache(normalized.slug, normalized);
          synced++;
        }
      }
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (err) {
      console.warn(`[syncProductDetailsPool] Error syncing product ${id}:`, err.message);
    }
  }

  // Refresh merged catalog disk cache with newly pooled details
  await fetchZohoProducts({ refresh: true });

  return { synced, total: all.length, remaining: candidates.length - synced };
}

