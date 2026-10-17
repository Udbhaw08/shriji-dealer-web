import { getSupabaseSchemes } from "../backend/src/services/content.js";
import { fetchZohoSchemes, DEFAULT_SCHEMES } from "./zoho.js";

export default async function handler(req, res) {
  try {
    const refresh = req.query?.refresh === "true" || req.query?.refresh === "1";
    // 1. Primary CMS: Supabase Storage & store_content
    const supabaseSchemes = await getSupabaseSchemes();
    const hasActiveSupabase = supabaseSchemes && Array.isArray(supabaseSchemes.active) && supabaseSchemes.active.length > 0;

    let finalSchemes;
    if (hasActiveSupabase) {
      finalSchemes = supabaseSchemes;
    } else {
      // 2. Safety Fallback: Automatically shift to Zoho Commerce active/inactive rules
      finalSchemes = await fetchZohoSchemes({ refresh });
    }

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, schemes: finalSchemes });
  } catch (err) {
    console.warn("[api/schemes] Supabase query error, shifting to Zoho fallback:", err.message);
    const fallback = await fetchZohoSchemes().catch(() => DEFAULT_SCHEMES);
    return res.status(200).json({ ok: true, schemes: fallback });
  }
}
