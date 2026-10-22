import {
  getAllStoreContent,
  upsertStoreContent,
  deleteStoreContent,
  toggleStoreContentActive,
} from "../backend/src/services/content.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const method = req.method?.toUpperCase() || "GET";
    const urlObj = new URL(req.url, "http://localhost");
    const query = Object.fromEntries(urlObj.searchParams.entries());

    // GET /api/content or GET /api/content?type=hero_banner
    if (method === "GET") {
      const type = query.type || null;
      const items = await getAllStoreContent(type);
      return res.status(200).json({ ok: true, count: items.length, items });
    }

    // POST /api/content - Upsert content
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

    // DELETE /api/content?id=...
    if (method === "DELETE") {
      const id = query.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Item id is required for deletion." });
      }
      const deleted = await deleteStoreContent(id);
      return res.status(200).json({ ok: true, deleted });
    }

    // PATCH /api/content?action=toggle&id=...
    if (method === "PATCH" || (method === "POST" && query.action === "toggle")) {
      const id = query.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ ok: false, error: "Item id is required to toggle status." });
      }
      const toggled = await toggleStoreContentActive(id);
      return res.status(200).json({ ok: true, item: toggled });
    }

    return res.status(405).json({ ok: false, error: `Method ${method} not allowed` });
  } catch (err) {
    console.error("[api/content] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
