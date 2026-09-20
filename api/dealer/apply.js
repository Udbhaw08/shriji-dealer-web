import { createDealerContact } from "../zoho.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (!payload.shop || !payload.person || !payload.phone) {
      return res.status(400).json({ error: "Shop name, contact person, and phone are required." });
    }

    const created = await createDealerContact(payload);
    return res.status(200).json({ ok: true, dealer: created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
