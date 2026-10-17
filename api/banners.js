import { getSupabaseBanners } from "../backend/src/services/content.js";
import { fetchZohoBanners, DEFAULT_STORE_BANNERS } from "./zoho.js";

export default async function handler(req, res) {
  try {
    const refresh = req.query?.refresh === "true" || req.query?.refresh === "1";
    // 1. Primary CMS: Supabase Storage & store_content
    const supabaseBanners = await getSupabaseBanners();

    let finalBanners;
    if (Array.isArray(supabaseBanners) && supabaseBanners.length > 0) {
      finalBanners = supabaseBanners;
    } else {
      // 2. Safety Fallback: Automatically shift to Zoho Commerce active/inactive rules
      finalBanners = await fetchZohoBanners({ refresh });
    }

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, count: finalBanners.length, banners: finalBanners });
  } catch (err) {
    console.warn("[api/banners] Supabase query error, shifting to Zoho fallback:", err.message);
    const fallback = await fetchZohoBanners().catch(() => DEFAULT_STORE_BANNERS);
    return res.status(200).json({ ok: true, count: fallback.length, banners: fallback });
  }
}
