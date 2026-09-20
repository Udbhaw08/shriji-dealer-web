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

  const match = contacts[0];
  const isApproved = match.status === "active" || match.portal_status === "enabled";
  const resolvedPhone = match.phone || match.mobile || cleanPhone;
  let digits = String(resolvedPhone).replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;

  return {
    id: match.contact_id,
    name: match.company_name || match.contact_name,
    person: match.first_name ? `${match.first_name} ${match.last_name || ""}`.trim() : (match.contact_name || match.company_name),
    phone: resolvedPhone,
    phoneRaw: digits,
    city: match.place_of_contact_formatted || match.place_of_contact || "",
    status: isApproved ? "approved" : "pending",
    rawStatus: match.status,
    tier: isApproved ? "Verified Dealer" : "Pending Verification",
    rebatePct: 20, // default dealer discount on MRP
  };
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
