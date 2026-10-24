import { fetchZohoProducts, fetchZohoCategories } from "../zoho.js";
import { getDealerPricingEligibility, maskCatalogPricing } from "../dealerPricingAuth.js";

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
    const { eligible, pricebookId } = await getDealerPricingEligibility(req);

    const targetPricebookId = eligible && pricebookId ? pricebookId : "3334672000000547177";

    const [rawProducts, categories] = await Promise.all([
      fetchZohoProducts({ refresh, pricebookId: targetPricebookId }),
      fetchZohoCategories({ refresh }),
    ]);

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
