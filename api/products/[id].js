import { fetchZohoProductById } from "../_lib/zoho.js";
import { getDealerPricingEligibility, maskProductPricing } from "../_lib/dealerPricingAuth.js";

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
    let { id } = req.query || {};

    if (!id && req.url) {
      const pathname = req.url.split("?")[0];
      const segments = pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last !== "[id]" && last !== "products") {
        id = decodeURIComponent(last);
      }
    }

    if (!id) {
      return res.status(400).json({ error: "Missing product id" });
    }

    // Server-side authorization check: never trust client-supplied pricebook_id
    const { eligible, pricebookId } = await getDealerPricingEligibility(req);
    const targetPricebookId = eligible && pricebookId ? pricebookId : "3334672000000547177";

    const rawProduct = await fetchZohoProductById(id, { pricebookId: targetPricebookId });
    if (!rawProduct) {
      return res.status(404).json({ error: "Product not found in Zoho" });
    }

    // Mask purchase rate and dealer rate for unauthorized visitors
    const product = maskProductPricing(rawProduct, eligible);

    if (eligible) {
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    }

    return res.status(200).json({ ok: true, product });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
