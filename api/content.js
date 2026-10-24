import {
  getAllStoreContent,
  upsertStoreContent,
  deleteStoreContent,
  toggleStoreContentActive,
  getHeroSliderSettings,
  saveHeroSliderSettings,
  getSupabaseBanners,
  getSupabaseSchemes,
  getSupabaseBranding,
} from "../backend/src/services/content.js";
import { verifyAdminAuth } from "./adminAuth.js";

const ALLOWED_CONTENT_TYPES = ["hero_banner", "scheme", "branding", "setting"];

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const method = req.method?.toUpperCase() || "GET";
    const urlObj = new URL(req.url, "http://localhost");
    const query = Object.fromEntries(urlObj.searchParams.entries());

    // Check admin authentication for any mutation operation
    const isMutation = method !== "GET" || query.action === "toggle";
    if (isMutation) {
      const auth = await verifyAdminAuth(req);
      if (!auth.ok) {
        return res.status(401).json({ ok: false, error: "admin_auth_required" });
      }
    }

    // 1. Banners scope: GET /api/content?scope=banners or /api/banners
    if (query.scope === "banners") {
      const [banners, settings] = await Promise.all([
        getSupabaseBanners(),
        getHeroSliderSettings(),
      ]);
      res.setHeader("Cache-Control", query.refresh === "true" ? "no-store, no-cache, must-revalidate" : "public, s-maxage=5, stale-while-revalidate=30");
      return res.status(200).json({ ok: true, count: banners.length, banners, settings });
    }

    // 2. Schemes scope: GET /api/content?scope=schemes or /api/schemes
    if (query.scope === "schemes") {
      const schemes = await getSupabaseSchemes();
      res.setHeader("Cache-Control", query.refresh === "true" ? "no-store, no-cache, must-revalidate" : "public, s-maxage=5, stale-while-revalidate=30");
      return res.status(200).json({ ok: true, schemes });
    }

    // 3. Branding scope: GET /api/content?scope=branding or /api/branding
    if (query.scope === "branding") {
      const branding = await getSupabaseBranding();
      res.setHeader("Cache-Control", query.refresh === "true" ? "no-store, no-cache, must-revalidate" : "public, s-maxage=5, stale-while-revalidate=30");
      return res.status(200).json({ ok: true, branding });
    }

    // 4. Slider settings scope: GET /api/content?scope=slider_settings
    if (query.scope === "slider_settings") {
      const settings = await getHeroSliderSettings();
      return res.status(200).json({ ok: true, settings });
    }

    // POST /api/content?scope=slider_settings
    if (query.scope === "slider_settings" || req.body?.action === "save_slider_settings") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {}
      }
      const settings = body?.settings || body || {};
      const saved = await saveHeroSliderSettings(settings);
      return res.status(200).json({ ok: true, settings: saved });
    }

    // 5. Toggle active status: POST/PATCH /api/content?action=toggle&id=...
    if (query.action === "toggle" || method === "PATCH" || req.body?.action === "toggle") {
      const id = query.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Item id is required to toggle status." });
      }
      const toggled = await toggleStoreContentActive(id);
      return res.status(200).json({ ok: true, item: toggled });
    }

    // 6. DELETE /api/content?id=...
    if (method === "DELETE") {
      const id = query.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Item id is required for deletion." });
      }
      const deleted = await deleteStoreContent(id);
      return res.status(200).json({ ok: true, deleted });
    }

    // 7. GET /api/content or GET /api/content?type=hero_banner
    if (method === "GET") {
      const type = query.type || null;
      const items = await getAllStoreContent(type);
      return res.status(200).json({ ok: true, count: items.length, items });
    }

    // 8. POST /api/content - Upsert content
    if (method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const { id, type, title } = body || {};
      if (!id || !type || !title) {
        return res.status(400).json({ ok: false, error: "id, type, and title are required." });
      }

      const item = await upsertStoreContent(body);
      return res.status(200).json({ ok: true, item });
    }

    return res.status(405).json({ ok: false, error: `Method ${method} not allowed` });
  } catch (err) {
    console.error("[api/content] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
