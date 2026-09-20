import { findDealerByPhone } from "../zoho.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { phone } = body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number or email is required" });
    }

    const dealer = await findDealerByPhone(phone);
    if (!dealer) {
      return res.status(404).json({ error: "No dealer account found with this phone number. Please submit an application below." });
    }

    return res.status(200).json({ ok: true, dealer });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
