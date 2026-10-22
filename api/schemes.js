import { getSupabaseSchemes } from "../backend/src/services/content.js";

export default async function handler(req, res) {
  try {
    const schemes = await getSupabaseSchemes();
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json({ ok: true, schemes });
  } catch (err) {
    console.error("[api/schemes] Supabase query error:", err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      schemes: { active: [], upcoming: [], past: [] },
    });
  }
}

