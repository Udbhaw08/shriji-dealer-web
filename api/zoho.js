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

const cacheFile = path.resolve(os.tmpdir(), "webstore_zoho_token.json");

export async function getAccessToken() {
  const env = loadEnv();
  const now = Date.now();

  if (cachedAccessToken && now < tokenExpiryTime - 60000) {
    return cachedAccessToken;
  }

  // Check on-disk cache
  if (fs.existsSync(cacheFile)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      if (diskData.access_token && now < diskData.expires_at - 60000) {
        cachedAccessToken = diskData.access_token;
        tokenExpiryTime = diskData.expires_at;
        return cachedAccessToken;
      }
    } catch {}
  }

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
    throw new Error(`Failed to refresh Zoho token: ${data.error || JSON.stringify(data)}`);
  }

  cachedAccessToken = data.access_token;
  tokenExpiryTime = now + (data.expires_in || 3600) * 1000;

  try {
    fs.writeFileSync(cacheFile, JSON.stringify({ access_token: cachedAccessToken, expires_at: tokenExpiryTime }), "utf-8");
  } catch {}

  return cachedAccessToken;
}

export function getZohoConfig() {
  const env = loadEnv();
  return {
    dc: env.ZOHO_DC || "in",
    orgId: env.ZOHO_ORG_ID || "60061569211",
  };
}

/**
 * Search contacts in Zoho Books by phone / mobile number.
 */
export async function findDealerByPhone(rawPhone) {
  const token = await getAccessToken();
  const { dc, orgId } = getZohoConfig();

  // Normalize phone or email:
  const isEmail = String(rawPhone).includes("@");
  const cleanPhone = String(rawPhone).replace(/\D/g, "").slice(-10);

  let url = `https://www.zohoapis.${dc}/books/v3/contacts?organization_id=${orgId}`;
  if (isEmail) {
    url += `&email=${encodeURIComponent(rawPhone.trim())}`;
  } else {
    url += `&phone=${encodeURIComponent(cleanPhone)}`;
  }

  let res = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });

  let data = await res.json();
  let contacts = data.contacts || [];

  // If not found by phone and it wasn't an email, try search_text
  if (contacts.length === 0 && !isEmail) {
    const searchUrl = `https://www.zohoapis.${dc}/books/v3/contacts?organization_id=${orgId}&search_text=${encodeURIComponent(cleanPhone)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    });
    const searchData = await searchRes.json();
    contacts = searchData.contacts || [];
  }

  if (contacts.length === 0) return null;

  // Crucial: fetch the full contact record so pricebook_id, pricebook_name, and portal_status are always fresh!
  return await getDealerById(contacts[0].contact_id);
}

/**
 * Fetch a specific dealer by Zoho contact ID.
 */
export async function getDealerById(contactId) {
  const token = await getAccessToken();
  const { dc, orgId } = getZohoConfig();

  const url = `https://www.zohoapis.${dc}/books/v3/contacts/${contactId}?organization_id=${orgId}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
    },
  });

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

  const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);

  // Payload adhering to Zoho Books Contacts specification
  const payload = {
    contact_name: shop ? `${shop} (${person})` : person,
    company_name: shop,
    customer_sub_type: "business",
    contact_type: "customer",
    status: "inactive", // inactive until approved by admin in Zoho
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
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
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

let cachedProducts = null;
let productsCacheTime = 0;
let cachedCategories = null;

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

function normalizeProduct(p) {
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
  if (lowerName.includes("bldc")) features.push("BLDC Motor");
  if (lowerName.includes("auto")) features.push("Auto Ignition");
  if (lowerName.includes("spill")) features.push("Spill Proof");
  if (lowerName.includes("flame")) features.push("Flame Failure Device");

  const mrp = Number(variant.label_rate || p.min_rate || variant.rate || 0);

  return {
    id: p.product_id,
    name: p.name,
    model: p.product_short_description || p.name,
    size,
    burners,
    finish,
    fkey,
    features,
    brand: p.brand || "Sunshine",
    cat: catKey,
    catLabel: catName,
    code: catKey.substring(0, 2).toUpperCase(),
    mrp,
    purchaseRate: Number(variant.purchase_rate || 0),
    stock: p.overall_stock ?? variant.stock_on_hand ?? 0,
    img,
    images: images.length ? images : (img ? [img] : []),
    description: p.description || p.product_description || "",
    status: p.status || "active",
  };
}

export async function fetchZohoCategories({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cachedCategories && now - productsCacheTime < 30000) {
    return cachedCategories;
  }

  const token = await getAccessToken();
  const { dc, orgId } = getZohoConfig();

  const res = await fetch(`https://commerce.zoho.${dc}/store/api/v1/categories`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "X-com-zoho-store-organizationid": orgId,
    },
  });

  const data = await res.json();
  const rawList = data.categories || [];

  const categories = rawList
    .filter((c) => c.category_id !== "-1" && c.url !== "rootcategory" && c.name !== "ROOT" && c.name !== "Adjustments")
    .map((c) => ({
      id: c.category_id,
      key: slugifyCategory(c.name),
      label: c.name,
      code: slugifyCategory(c.name).substring(0, 2).toUpperCase(),
      img: `/img/cat-${slugifyCategory(c.name)}.webp`,
    }));

  cachedCategories = categories;
  return categories;
}

export async function fetchZohoProducts({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cachedProducts && now - productsCacheTime < 30000) {
    return cachedProducts;
  }

  const token = await getAccessToken();
  const { dc, orgId } = getZohoConfig();

  const allProducts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `https://commerce.zoho.${dc}/store/api/v1/products?page=${page}&per_page=200`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "X-com-zoho-store-organizationid": orgId,
      },
    });

    const data = await res.json();
    const batch = data.products || [];
    allProducts.push(...batch);

    hasMore = Boolean(data.page_context?.has_more_page);
    page += 1;
    if (page > 10) break; // safety break
  }

  const normalized = allProducts.map(normalizeProduct);

  cachedProducts = normalized;
  productsCacheTime = now;
  return normalized;
}

export async function fetchZohoProductById(productId) {
  // If product is in cached list, check first
  if (cachedProducts) {
    const found = cachedProducts.find((p) => p.id === productId);
    if (found && found.images?.length > 1) return found;
  }

  const token = await getAccessToken();
  const { dc, orgId } = getZohoConfig();

  const res = await fetch(`https://commerce.zoho.${dc}/store/api/v1/products/${productId}`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "X-com-zoho-store-organizationid": orgId,
    },
  });

  const data = await res.json();
  if (!data.product) return null;

  return normalizeProduct(data.product);
}
