import { getSupabaseBanners } from "../backend/src/services/content.js";

export default async function handler(req, res) {
  try {
    const banners = await getSupabaseBanners();
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, count: banners.length, banners });
  } catch (err) {
    console.error("[api/banners] Supabase query error:", err.message);
    return res.status(500).json({ ok: false, error: err.message, banners: [] });
  }
}

