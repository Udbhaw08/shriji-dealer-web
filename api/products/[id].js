import { fetchZohoProductById } from "../zoho.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    let { id, pricebook_id } = req.query || {};

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

    const product = await fetchZohoProductById(id, { pricebookId: pricebook_id || "3334672000000547177" });
    if (!product) {
      return res.status(404).json({ error: "Product not found in Zoho" });
    }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return res.status(200).json({ ok: true, product });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
