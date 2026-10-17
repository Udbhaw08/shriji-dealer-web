import { getSupabaseBranding } from "../backend/src/services/content.js";

export default async function handler(req, res) {
  try {
    const branding = await getSupabaseBranding();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ ok: true, branding });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
