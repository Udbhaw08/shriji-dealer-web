import { getAccessToken, getZohoConfig } from "../api/_lib/zoho.js";

const { dc, orgId } = getZohoConfig();

// 1. Get Access Token (cached)
console.log("1. Fetching Access Token (using cache / singleflight)...");
const accessToken = await getAccessToken();
console.log("✅ Access token acquired!");

// 2. Test Zoho Commerce API (Products / Store settings)
console.log("2. Testing Zoho Commerce Items / Products endpoint...");
const productsRes = await fetch(`https://commerce.zoho.${dc}/store/api/v1/products`, {
  headers: {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
    "X-com-zoho-store-organizationid": orgId,
  },
});
const productsData = await productsRes.json().catch(() => ({}));
console.log("Commerce Products API Status:", productsRes.status, "Response code:", productsData.code || productsData.message || Object.keys(productsData));

// 3. Test Zoho Books / Contacts API (for dealers & customers)
console.log("3. Testing Contacts API for Dealers/Customers...");
const contactsRes = await fetch(`https://www.zohoapis.${dc}/books/v3/contacts?organization_id=${orgId}`, {
  headers: {
    Authorization: `Zoho-oauthtoken ${accessToken}`,
  },
});
const contactsData = await contactsRes.json().catch(() => ({}));
console.log("Contacts API Status:", contactsRes.status, "Response:", contactsData);
if (contactsData.contacts) {
  console.log(`Found ${contactsData.contacts.length} existing contacts in Zoho.`);
}
