import {
  fetchAllRawZohoProducts,
  fetchZohoProducts,
  getZohoConfig,
  fetchZohoWithRetry,
  normalizeProduct,
  readProductDetailsDiskCache,
  writeProductDetailDiskCache,
  fetchResolvedPricebookRates,
  isBannerItem,
  isSchemeItem,
  isLogoItem,
  getTrialCollectionId,
  fetchZohoCollectionProductIds,
} from "../api/_lib/zoho.js";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
  const delayArg = args.find((a) => a.startsWith("--delay="));
  const delayMs = delayArg ? parseInt(delayArg.split("=")[1], 10) : 150;

  console.log("🚀 Starting Zoho Commerce Full Product Sync...");
  console.log(`Settings: force=${force}, limit=${limit}, delayMs=${delayMs}ms\n`);

  const { dc, orgId } = getZohoConfig();
  const all = await fetchAllRawZohoProducts({ refresh: false });
  console.log(`📦 Total items in Zoho raw catalogue: ${all.length}`);

  const activeProducts = all.filter(
    (p) => !isBannerItem(p) && !isSchemeItem(p) && !isLogoItem(p) && p.show_in_storefront !== false
  );
  console.log(`✨ Active catalogue products to sync: ${activeProducts.length}`);

  const diskDetails = readProductDetailsDiskCache();
  const livePricebookRates = await fetchResolvedPricebookRates("3334672000000547177");

  const trialColId = getTrialCollectionId();
  const trialProductIds = await fetchZohoCollectionProductIds(trialColId, { refresh: true }).catch(() => []);
  console.log(`✨ Trial Collection "${trialColId}": ${trialProductIds.length} items`);

  const toSync = activeProducts.filter((p) => {
    const id = p.product_id || p.id;
    if (force) return true;
    if (trialProductIds.includes(String(id))) return true;
    const existing = diskDetails[id]?.product;
    // If not existing or doesn't have fulfillment/hsnCode checked yet
    return !existing || !existing.hsnCode;
  });

  // Prioritize trial collection items at top of sync list
  toSync.sort((a, b) => {
    const aTrial = trialProductIds.includes(String(a.product_id || a.id));
    const bTrial = trialProductIds.includes(String(b.product_id || b.id));
    if (aTrial && !bTrial) return -1;
    if (!aTrial && bTrial) return 1;
    return 0;
  });

  console.log(`🔍 Need full detail fetch: ${toSync.length} products (already cached: ${activeProducts.length - toSync.length})\n`);

  const targetList = toSync.slice(0, limit);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < targetList.length; i++) {
    const item = targetList[i];
    const id = item.product_id || item.id;
    const name = item.name || id;

    process.stdout.write(`[${i + 1}/${targetList.length}] Fetching ${name.slice(0, 40)}... `);

    try {
      const res = await fetchZohoWithRetry(`https://commerce.zoho.${dc}/store/api/v1/products/${id}`, {
        headers: { "X-com-zoho-store-organizationid": orgId },
      });

      if (res.status === 429) {
        console.log("\n⚠️ Zoho API 429 rate limit hit. Pausing for 60 seconds...");
        await new Promise((r) => setTimeout(r, 60000));
        i--; // retry this item
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          const normalized = normalizeProduct(data.product, livePricebookRates);
          writeProductDetailDiskCache(id, normalized);
          if (normalized.slug) writeProductDetailDiskCache(normalized.slug, normalized);
          successCount++;
          console.log(`✅ OK (HSN: ${normalized.hsnCode || "none"}, Specs: ${normalized.specifications?.length || 0})`);
        } else {
          console.log("⚠️ No product payload");
          errorCount++;
        }
      } else {
        console.log(`❌ HTTP ${res.status}`);
        errorCount++;
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      errorCount++;
    }

    if (delayMs > 0 && i < targetList.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`\n🎉 Detail sync completed: ${successCount} synced, ${errorCount} errors.`);
  console.log("🔄 Updating merged catalogue disk cache...");
  const refreshed = await fetchZohoProducts({ refresh: true });
  console.log(`✅ Merged catalogue refreshed with ${refreshed.length} active products.`);
}

main().catch((err) => {
  console.error("Fatal sync error:", err);
  process.exit(1);
});
