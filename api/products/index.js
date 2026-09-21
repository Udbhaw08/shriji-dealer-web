import { fetchZohoProducts, fetchZohoCategories } from "../zoho.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const refresh = req.query?.refresh === "true";
    const pricebookId = req.query?.pricebook_id || "3334672000000547177";
    const [products, categories] = await Promise.all([
      fetchZohoProducts({ refresh, pricebookId }),
      fetchZohoCategories({ refresh }),
    ]);

    if (refresh) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
    } else {
      res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
    }
    return res.status(200).json({ ok: true, count: products.length, products, categories });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
