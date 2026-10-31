import app from "../../backend/src/app.js";

/**
 * Vercel Serverless Function Catch-All for /api/webhooks/* and /webhooks/*
 * Enables 100% serverless CRM webhook reception on restor.in (Vercel production)
 * with direct Supabase connectivity, completely decoupled from Render uptime.
 */
export default async function handler(req, res) {
  // Normalize req.url so Express router matches regardless of how Vercel rewrote it
  if (req.query?.path) {
    const subpath = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
    const urlObj = new URL(req.url, "http://localhost");
    urlObj.searchParams.delete("path");
    const qs = urlObj.searchParams.toString();
    req.url = "/api/webhooks/" + subpath + (qs ? `?${qs}` : "");
  } else if (!req.url.startsWith("/api/webhooks") && !req.url.startsWith("/webhooks")) {
    req.url = "/api/webhooks" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  return new Promise((resolve) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    app(req, res, (err) => {
      if (err) {
        console.error("[vercel-webhooks] Unhandled Express error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message || "Internal server error" });
        }
      }
      resolve();
    });
  });
}
