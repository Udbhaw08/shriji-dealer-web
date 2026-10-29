import app from "../../backend/src/app.js";

/**
 * Vercel Serverless Function Catch-All for /api/dealers/*
 * Enables 100% serverless dealer staff management & CRM synchronization on restor.in.
 */
export default async function handler(req, res) {
  // Normalize req.url so Express router matches regardless of how Vercel rewrote it
  if (req.query?.path) {
    const subpath = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
    const urlObj = new URL(req.url, "http://localhost");
    urlObj.searchParams.delete("path");
    const qs = urlObj.searchParams.toString();
    req.url = "/api/dealers/" + subpath + (qs ? `?${qs}` : "");
  } else if (!req.url.startsWith("/api/dealers") && !req.url.startsWith("/dealers")) {
    req.url = "/api/dealers" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  return new Promise((resolve) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    app(req, res, (err) => {
      if (err) {
        console.error("[vercel-dealers] Unhandled Express error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message || "Internal server error" });
        }
      }
      resolve();
    });
  });
}
