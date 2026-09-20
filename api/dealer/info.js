import { getDealerById } from "../zoho.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: "Missing dealer id parameter" });
    }

    const dealer = await getDealerById(id);
    if (!dealer) {
      return res.status(404).json({ error: "Dealer not found in Zoho" });
    }

    return res.status(200).json({ ok: true, dealer });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
