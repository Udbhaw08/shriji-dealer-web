import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) env[match[1]] = (match[2] || "").trim();
}

const dc = env.ZOHO_DC || "in";
const orgId = env.ZOHO_ORG_ID;

// 1. Get Access Token
console.log("1. Fetching Access Token using Refresh Token...");
const tokenRes = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    refresh_token: env.ZOHO_REFRESH_TOKEN,
  }),
});

const tokenData = await tokenRes.json();
if (!tokenData.access_token) {
  console.error("Token error:", tokenData);
  process.exit(1);
}
console.log("✅ Access token acquired!");

// 2. Test Zoho Commerce API (Products / Store settings)
console.log("2. Testing Zoho Commerce Items / Products endpoint...");
const productsRes = await fetch(`https://commerce.zoho.${dc}/store/api/v1/products`, {
  headers: {
    Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
    "X-com-zoho-store-organizationid": orgId,
  },
});
const productsData = await productsRes.json().catch(() => ({}));
console.log("Commerce Products API Status:", productsRes.status, "Response code:", productsData.code || productsData.message || Object.keys(productsData));

// 3. Test Zoho Books / Contacts API (for dealers & customers)
console.log("3. Testing Contacts API for Dealers/Customers...");
const contactsRes = await fetch(`https://www.zohoapis.${dc}/books/v3/contacts?organization_id=${orgId}`, {
  headers: {
    Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
  },
});
const contactsData = await contactsRes.json().catch(() => ({}));
console.log("Contacts API Status:", contactsRes.status, "Response:", contactsData);
if (contactsData.contacts) {
  console.log(`Found ${contactsData.contacts.length} existing contacts in Zoho.`);
}
