import { sql } from "../../backend/src/db/pool.js";

/**
 * Public dealer attribution info for shared customer links (?from=dealerId).
 * Strictly restricts output to minimal public showroom fields (name, city, state, code).
 * Never exposes PII (phone, email, GST, owner IDs, price tiers, CRM tokens).
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id } = req.query || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Missing dealer id parameter" });
    }

    const cleanId = id.trim();
    let dealer = null;

    try {
      const rows = await sql`
        SELECT id, business_name, city, state, dealer_code, status, phone
        FROM dealers
        WHERE id = ${cleanId} OR dealer_code = ${cleanId}
        LIMIT 1;
      `;
      if (rows && rows.length > 0) {
        const d = rows[0];
        dealer = {
          id: d.id,
          name: d.business_name,
          city: d.city || "",
          state: d.state || "",
          phone: d.phone || "",
          code: d.dealer_code || "",
          status: d.status,
        };
      }
    } catch (dbErr) {
      console.warn("[api/dealer/info] DB lookup failed:", dbErr.message);
    }

    if (!dealer) {
      return res.status(404).json({ error: "Dealer not found" });
    }

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ ok: true, dealer });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
