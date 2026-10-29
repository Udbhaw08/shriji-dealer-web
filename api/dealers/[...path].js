import app from "../../backend/src/app.js";

/**
 * Vercel Serverless Function Catch-All for /api/dealers/*
 * Enables 100% serverless dealer staff management & CRM synchronization on restor.in.
 */
export default async function handler(req, res) {
  // Normalize req.url so Express router matches regardless of how Vercel rewrote it
  if (req.query?.path) {
    const subpath = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
    req.url = "/api/dealers/" + subpath;
  } else if (!req.url.startsWith("/api/dealers") && !req.url.startsWith("/dealers")) {
    req.url = "/api/dealers" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }

  return new Promise((resolve) => {
    app(req, res, (result) => {
      resolve(result);
    });
  });
}
