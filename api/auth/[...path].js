import app from "../../backend/src/app.js";

/**
 * Vercel Serverless Function Catch-All for /api/auth/*
 * Enables 100% serverless dealer & staff authentication on restor.in
 * with direct Supabase connectivity, completely decoupled from Render uptime.
 */
export default async function handler(req, res) {
  // Normalize req.url so Express router matches regardless of how Vercel rewrote it
  if (req.query?.path) {
    const subpath = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
    req.url = "/api/auth/" + subpath;
  } else if (!req.url.startsWith("/api/auth") && !req.url.startsWith("/auth")) {
    req.url = "/api/auth" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  return new Promise((resolve) => {
    // Pass to Express application
    app(req, res, (result) => {
      resolve(result);
    });
  });
}
