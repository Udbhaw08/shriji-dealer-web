import { readTagCache, syncRecentProductTags } from "../zoho.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    syncRecentProductTags().catch(() => {});
    const cache = readTagCache();
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ ok: true, count: Object.keys(cache).length, tags: cache });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
