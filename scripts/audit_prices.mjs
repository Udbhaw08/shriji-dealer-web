import fs from "node:fs";
import path from "node:path";
import { fetchZohoProducts } from "../api/_lib/zoho.js";

const csvPath = "C:/Users/udbha/.gemini/antigravity-ide/brain/24b5df03-676f-4e08-92c5-460f7bfe7326/.user_uploaded/media_1789938249196.csv";
const content = fs.readFileSync(csvPath, "utf-8");
const lines = content.split(/\r?\n/).filter(Boolean);

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const parsedHeader = parseCSVLine(lines[0]);
const idIdx = parsedHeader.indexOf("Product ID");
const nameIdx = parsedHeader.indexOf("Product Name");
const spIdx = parsedHeader.indexOf("Selling Price");
const lpIdx = parsedHeader.indexOf("Label Price");
const statusIdx = parsedHeader.indexOf("Status");
const showIdx = parsedHeader.indexOf("Show In Store");

const csvItems = {};
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const rawId = cols[idIdx] || "";
  const id = rawId.replace(/^ZID:/, "").trim();
  if (!id) continue;
  const name = cols[nameIdx]?.trim();
  const spRaw = cols[spIdx] || "";
  const lpRaw = cols[lpIdx] || "";
  const sp = parseFloat(spRaw.replace(/[^\d.]/g, "") || "0");
  const lp = parseFloat(lpRaw.replace(/[^\d.]/g, "") || "0");
  csvItems[id] = {
    id,
    name,
    sp,
    lp,
    status: cols[statusIdx]?.trim(),
    showInStore: cols[showIdx]?.trim()
  };
}

console.log(`Total CSV items: ${Object.keys(csvItems).length}`);

async function run() {
  const prods = await fetchZohoProducts({ refresh: true });
  console.log(`Total Zoho API products fetched: ${prods.length}`);

  let matches = 0;
  let differences = [];
  let missingInApi = [];

  for (const [id, cItem] of Object.entries(csvItems)) {
    const apiProd = prods.find((p) => p.id === id);
    if (!apiProd) {
      missingInApi.push(cItem);
      continue;
    }

    // Compare with API mrp
    const expectedPrice = cItem.lp || cItem.sp || 0;
    if (apiProd.mrp === expectedPrice) {
      matches++;
    } else {
      differences.push({
        id,
        name: cItem.name,
        csv_sp: cItem.sp,
        csv_lp: cItem.lp,
        api_mrp: apiProd.mrp,
      });
    }
  }

  const spLpDiffs = [];
  let showYes = 0;
  let showNo = 0;
  let zeroInStore = [];

  for (const [id, cItem] of Object.entries(csvItems)) {
    if (cItem.sp !== cItem.lp) {
      spLpDiffs.push(cItem);
    }
    if (cItem.showInStore === "YES") {
      showYes++;
      const effectivePrice = cItem.lp || cItem.sp || 0;
      if (effectivePrice === 0) {
        zeroInStore.push(cItem);
      }
    } else {
      showNo++;
    }
  }

  console.log(`\nStorefront status:`);
  console.log(`- Show in Store YES: ${showYes}`);
  console.log(`- Show in Store NO: ${showNo}`);
  console.log(`- Show in Store YES but Price is 0 in Zoho: ${zeroInStore.length}`);
  console.log(`Sample zero-price store items:`, zeroInStore.slice(0, 10).map((x) => x.name));

  console.log(`\nItems in CSV where Selling Price !== Label Price: ${spLpDiffs.length}`);
  console.log("Sample Selling Price !== Label Price:", JSON.stringify(spLpDiffs.slice(0, 15), null, 2));

  console.log(`\nResults:`);
  console.log(`- Exact price matches: ${matches}`);
  console.log(`- Differences: ${differences.length}`);
  if (differences.length > 0) {
    console.log("Difference items:", JSON.stringify(differences, null, 2));
  }
  console.log(`- In CSV but not returned by API: ${missingInApi.length}`);
  if (missingInApi.length > 0) {
    console.log("Missing items sample:", missingInApi.slice(0, 5));
  }
}

run().catch(console.error);
