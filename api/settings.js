import path from "node:path";
import { pathToFileURL } from "node:url";

async function getContentService() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const fullPath = path.resolve(process.cwd(), "backend/src/services/content.js");
      return await import(/* @vite-ignore */ `${pathToFileURL(fullPath).href}?t=${Date.now()}`);
    } catch (e) {
      console.warn("[api/settings] Dynamic content service load failed:", e.message);
    }
  }
  return await import("../backend/src/services/content.js");
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    const { getHeroSliderSettings } = await getContentService();
    const settings = await getHeroSliderSettings();
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
    return res.status(200).json({ ok: true, settings });
  } catch (err) {
    console.error("[api/settings] Error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

