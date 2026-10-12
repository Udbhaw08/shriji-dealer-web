import fs from 'node:fs';
import path from 'node:path';

function getMergedEnv() {
  const env = { ...process.env };
  for (const envFile of ['.env.local', 'backend/.env']) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && !env[match[1]]) {
          env[match[1]] = (match[2] || '').trim();
        }
      }
    }
  }
  return env;
}

const env = getMergedEnv();
const dc = env.ZOHO_DC || 'in';
const orgId = env.ZOHO_ORG_ID;

async function getAccessToken() {
  const res = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      refresh_token: env.ZOHO_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh failed');
  return data.access_token;
}

async function main() {
  const token = await getAccessToken();
  console.log('Fetching pricebooks from Zoho Commerce...');

  const pbRes = await fetch(`https://commerce.zoho.${dc}/store/api/v1/pricebooks`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'X-com-zoho-store-organizationid': orgId,
    },
  });
  const pbData = await pbRes.json();
  const pricebooks = pbData.pricebooks || [];

  const outDir = path.resolve(process.cwd(), 'docs/pricebooks_export');
  fs.mkdirSync(outDir, { recursive: true });

  for (const pb of pricebooks) {
    console.log(`Exporting: ${pb.name} (${pb.pricebook_id})...`);
    const r = await fetch(`https://commerce.zoho.${dc}/store/api/v1/pricebooks/${pb.pricebook_id}`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'X-com-zoho-store-organizationid': orgId,
      },
    });
    const d = await r.json();
    const items = d.pricebook?.pricebook_items || [];

    const csvRows = [
      ['Pricebook Name', 'Product / Item Name', 'Item ID', 'Pricebook Rate', 'Discount', 'Status'].join(','),
    ];

    for (const it of items) {
      const cleanName = `"${(it.name || '').replace(/"/g, '""')}"`;
      csvRows.push([
        `"${pb.name}"`,
        cleanName,
        it.item_id,
        it.pricebook_rate ?? '',
        it.pricebook_discount ?? '',
        pb.status,
      ].join(','));
    }

    const fileName = `${pb.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, csvRows.join('\n'), 'utf8');
    console.log(` Saved ${items.length} items to ${filePath}`);
  }

  console.log('\nAll pricebooks exported to docs/pricebooks_export/');
}

main().catch(console.error);
