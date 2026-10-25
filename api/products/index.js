import { fetchZohoProducts, fetchZohoCategories, readProductsDiskCache } from "../_lib/zoho.js";
import { getDealerPricingEligibility, maskCatalogPricing } from "../_lib/dealerPricingAuth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const refresh = req.query?.refresh === "true";

    // Enforce server-side authorization: only verified approved dealers/staff get wholesale pricing
    let eligible = false;
    let pricebookId = null;
    try {
      const authResult = await getDealerPricingEligibility(req);
      eligible = Boolean(authResult?.eligible);
      pricebookId = authResult?.pricebookId || null;
    } catch (authErr) {
      console.warn("[api/products] auth check failed, defaulting to customer view:", authErr.message);
    }

    const targetPricebookId = eligible && pricebookId ? pricebookId : "3334672000000547177";

    let rawProducts = [];
    let categories = [];
    try {
      const results = await Promise.all([
        fetchZohoProducts({ refresh, pricebookId: targetPricebookId }),
        fetchZohoCategories({ refresh }),
      ]);
      rawProducts = results[0] || [];
      categories = results[1] || [];
    } catch (fetchErr) {
      console.warn("[api/products] Zoho fetch failed, attempting cache fallback:", fetchErr.message);
      const diskData = readProductsDiskCache();
      if (diskData?.products?.length) {
        rawProducts = diskData.products;
        categories = diskData.categories || [];
      } else {
        throw fetchErr;
      }
    }

    // Mask restricted wholesale & internal purchase pricing for ineligible visitors
    const products = maskCatalogPricing(rawProducts, eligible);

    if (eligible) {
      // Never store authenticated dealer pricing in public/shared caches
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    } else if (refresh) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
    } else {
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    }

    return res.status(200).json({ ok: true, count: products.length, products, categories });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
