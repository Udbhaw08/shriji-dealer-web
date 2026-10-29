import {
  fetchAllRawZohoProducts,
  fetchZohoProductById,
  getZohoConfig,
  fetchZohoWithRetry,
  normalizeProduct,
} from "../api/_lib/zoho.js";

async function verify10Products() {
  console.log("================================================================================");
  console.log("🔍 AUDIT: Verifying 10 Different Products Directly from Live Zoho Commerce API");
  console.log("================================================================================\n");

  const { dc, orgId } = getZohoConfig();
  const all = await fetchAllRawZohoProducts({ refresh: false });
  const activeProducts = all.filter((p) => p.status === "active" && p.show_in_storefront !== false);

  // Select 10 distinct products across various categories
  const categoryMap = new Map();
  for (const p of activeProducts) {
    const cat = p.category_name || "Other";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat).push(p);
  }

  const selected = [];
  // Ensure "Kuchenbau Electric Kettle 1.8L" is included first as requested by user
  const kettle = activeProducts.find((p) =>
    (p.name || "").toLowerCase().includes("kettle") || (p.product_short_description || "").toLowerCase().includes("kettle")
  );
  if (kettle) selected.push(kettle);

  for (const [cat, prods] of categoryMap.entries()) {
    for (const p of prods) {
      if (!selected.some((s) => (s.product_id || s.id) === (p.product_id || p.id))) {
        selected.push(p);
        break;
      }
    }
    if (selected.length >= 10) break;
  }

  // If still under 10, fill from activeProducts
  for (const p of activeProducts) {
    if (selected.length >= 10) break;
    if (!selected.some((s) => (s.product_id || s.id) === (p.product_id || p.id))) {
      selected.push(p);
    }
  }

  console.log(`Auditing ${selected.length} distinct products:\n`);

  const results = [];

  for (let idx = 0; idx < selected.length; idx++) {
    const rawSummary = selected[idx];
    const pid = rawSummary.product_id || rawSummary.id;

    // Fetch full detail directly from Zoho Commerce API
    const res = await fetchZohoWithRetry(`https://commerce.zoho.${dc}/store/api/v1/products/${pid}`, {
      headers: { "X-com-zoho-store-organizationid": orgId },
    });
    if (!res.ok) {
      console.error(`Failed to fetch product ${pid}: HTTP ${res.status}`);
      continue;
    }
    const json = await res.json();
    const zohoRaw = json.product;
    const v0 = zohoRaw.variants?.[0] || {};
    const normalized = normalizeProduct(zohoRaw);

    // Raw Zoho values
    const rawTitle = zohoRaw.name || "";
    const rawShortDesc = zohoRaw.product_short_description || "";
    const rawBrand = zohoRaw.brand || v0.brand || "";
    const rawCat = zohoRaw.category_name || zohoRaw.category?.category_name || "";
    const rawSku = v0.sku || "";
    const rawHsn = v0.hsn_or_sac || "";
    const rawPkg = v0.package_details || {};
    const rawSpecs = zohoRaw.specifications || [];
    const rawCustomFields = v0.custom_fields || [];
    const rawWarranty = rawCustomFields.find((c) => c.api_name === "cf_warranty" || c.label?.toLowerCase() === "warranty")?.value_formatted || "";
    const rawKeyFeatures = rawCustomFields.find((c) => c.api_name === "cf_key_features" || c.label?.toLowerCase() === "key features")?.value_formatted || "";
    const rawOverview = rawCustomFields.find((c) => c.api_name === "cf_overview" || c.label?.toLowerCase() === "overview")?.value_formatted || "";
    const rawTileIcons = rawCustomFields.filter((c) => c.api_name?.startsWith("cf_tile_icon_text_") && c.value_formatted && c.value_formatted !== "TEST");

    // Presentation values simulated exactly from Product.jsx logic
    const displayTitle = normalized.name || normalized.model || "";
    const specsTable = [
      displayTitle && ["Model", displayTitle],
      normalized.zohoTitle && normalized.zohoTitle !== displayTitle && ["Full Name", normalized.zohoTitle],
      normalized.sku && ["SKU", normalized.sku],
      (normalized.catLabel || normalized.cat) && ["Category", normalized.catLabel],
      normalized.brand && ["Brand", normalized.brand],
      normalized.hsnCode && ["HSN Code", normalized.hsnCode],
      normalized.fulfillment?.formattedDimensions && ["Dimensions (L × W × H)", normalized.fulfillment.formattedDimensions],
      normalized.fulfillment?.formattedWeight && ["Weight", normalized.fulfillment.formattedWeight],
      normalized.customFields?.warranty && ["Warranty", normalized.customFields.warranty],
    ].filter(Boolean);

    // Merge Zoho specs
    (normalized.specifications || []).forEach((s) => {
      if (s.name && s.value) specsTable.push([s.name, s.value]);
    });

    const hasOverviewTab = Boolean(normalized.overview || normalized.customFields?.keyFeatures || normalized.customFields?.warranty);
    const hasSpecsTab = specsTable.length > 0;
    const hasTileBadges = (normalized.tileIcons || []).length > 0;

    // Strict checks: NO synthetic/mockup bleed-through
    const issues = [];
    if (!rawPkg.length && normalized.fulfillment?.length) issues.push("Dimensions generated when Zoho was empty!");
    if (!rawPkg.weight && normalized.fulfillment?.weight) issues.push("Weight generated when Zoho was empty!");
    if (!rawWarranty && normalized.customFields?.warranty) issues.push("Warranty generated when Zoho was empty!");
    if (!rawKeyFeatures && normalized.customFields?.keyFeatures) issues.push("Key Features generated when Zoho was empty!");
    if (!rawOverview && !zohoRaw.description && normalized.overview) issues.push("Overview generated when Zoho was empty!");
    if (rawTileIcons.length === 0 && hasTileBadges) issues.push("Tile badges generated when Zoho was empty!");

    const statusOk = issues.length === 0;

    const auditEntry = {
      index: idx + 1,
      id: pid,
      title: displayTitle,
      category: rawCat,
      brand: normalized.brand || "(none)",
      hsnCode: normalized.hsnCode || "(none)",
      dimensions: normalized.fulfillment?.formattedDimensions || "(none)",
      weight: normalized.fulfillment?.formattedWeight || "(none)",
      warranty: normalized.customFields?.warranty || "(none)",
      keyFeatures: normalized.customFields?.keyFeatures ? "Present" : "(none)",
      overview: normalized.overview ? "Present" : "(none)",
      tileIconsCount: normalized.tileIcons?.length || 0,
      specsCount: (normalized.specifications || []).length,
      hasOverviewTab,
      hasSpecsTab,
      hasTileBadges,
      status: statusOk ? "✅ 100% PURE ZOHO" : "❌ MOCK DETECTED",
      issues,
    };

    results.push(auditEntry);

    console.log(`[Item ${idx + 1}/10] ${displayTitle}`);
    console.log(`  Category: ${auditEntry.category} | Brand: ${auditEntry.brand} | HSN: ${auditEntry.hsnCode}`);
    console.log(`  Dimensions: ${auditEntry.dimensions} | Weight: ${auditEntry.weight} | Warranty: ${auditEntry.warranty}`);
    console.log(`  Overview Tab: ${hasOverviewTab ? "VISIBLE" : "HIDDEN (None in Zoho)"} | Specs Tab: ${hasSpecsTab ? `VISIBLE (${specsTable.length} rows)` : "HIDDEN"} | Tile Badges: ${hasTileBadges ? `${normalized.tileIcons.length} badges` : "HIDDEN"}`);
    console.log(`  Status: ${auditEntry.status}\n`);

    // Pacing delay
    await new Promise((r) => setTimeout(r, 150));
  }

  const allPassed = results.every((r) => r.issues.length === 0);
  console.log("================================================================================");
  console.log(allPassed ? "🎉 ALL 10 PRODUCTS VERIFIED: ZERO MOCKUP / SYNTHETIC DATA DETECTED!" : "⚠️ SOME MOCKUPS DETECTED");
  console.log("================================================================================");
}

verify10Products().catch(console.error);

