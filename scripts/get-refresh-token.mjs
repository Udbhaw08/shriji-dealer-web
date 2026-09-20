import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");

if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || "").trim();
  }
}

const dc = env.ZOHO_DC || "in";
const clientId = env.ZOHO_CLIENT_ID;
const clientSecret = env.ZOHO_CLIENT_SECRET;
const code = env.ZOHO_GRANT_CODE;

if (!clientId || !clientSecret || !code) {
  console.error("❌ Missing required variables in .env.local:");
  if (!clientId) console.error("   - ZOHO_CLIENT_ID is empty");
  if (!clientSecret) console.error("   - ZOHO_CLIENT_SECRET is empty");
  if (!code) console.error("   - ZOHO_GRANT_CODE is empty");
  process.exit(1);
}

console.log("🔄 Exchanging Grant Code for Refresh Token via Zoho OAuth...");

const url = `https://accounts.zoho.${dc}/oauth/v2/token`;
const params = new URLSearchParams({
  grant_type: "authorization_code",
  client_id: clientId,
  client_secret: clientSecret,
  code: code,
});

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();

  if (data.error) {
    console.error("❌ Zoho OAuth Error:", data.error, data.error_description || "");
    process.exit(1);
  }

  if (data.refresh_token) {
    console.log("✅ SUCCESS! Refresh Token received from Zoho.");
    
    let updated = envContent;
    if (updated.includes("ZOHO_REFRESH_TOKEN=")) {
      updated = updated.replace(/ZOHO_REFRESH_TOKEN=.*/, `ZOHO_REFRESH_TOKEN=${data.refresh_token}`);
    } else {
      updated += `\nZOHO_REFRESH_TOKEN=${data.refresh_token}\n`;
    }

    fs.writeFileSync(envPath, updated, "utf-8");
    console.log("🔒 Saved ZOHO_REFRESH_TOKEN to .env.local automatically!");
    console.log("Access Token expiry (seconds):", data.expires_in);
  } else {
    console.warn("⚠️ Response received but no refresh_token was returned:", data);
  }
} catch (err) {
  console.error("❌ Network or request error:", err.message);
  process.exit(1);
}
