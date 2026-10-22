import fs from "fs";
import path from "path";
import { sql } from "../backend/src/db/pool.js";

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".json": "application/json",
};

export default async function handler(req, res) {
  // CORS & caching headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Determine path from query
    let targetPath = req.query.path || req.query.file || "";
    if (Array.isArray(targetPath)) targetPath = targetPath.join("/");

    // Also support folder + file query params
    if (!targetPath && req.query.folder && req.query.name) {
      targetPath = `${req.query.folder}/${req.query.name}`;
    }

    targetPath = targetPath.replace(/^\/+/, "").replace(/\.\./g, ""); // sanitize
    const parts = targetPath.split("/").filter(Boolean);

    let folder = "";
    let filename = "";

    if (parts.length >= 2) {
      folder = parts[0];
      filename = parts.slice(1).join("/");
    } else if (parts.length === 1) {
      filename = parts[0];
    }

    if (!filename) {
      return res.status(400).json({ error: "File name is required" });
    }

    // 1. Try to fetch from Supabase database first (handles Vercel Serverless environment)
    try {
      let rows = [];
      if (folder) {
        rows = await sql`
          SELECT folder, filename, mime_type, data_base64, size
          FROM public.uploaded_files
          WHERE folder = ${folder} AND (filename = ${filename} OR id = ${filename})
          LIMIT 1;
        `;
      } else {
        rows = await sql`
          SELECT folder, filename, mime_type, data_base64, size
          FROM public.uploaded_files
          WHERE filename = ${filename} OR id = ${filename}
          LIMIT 1;
        `;
      }

      if (rows && rows.length > 0) {
        const file = rows[0];
        const ext = path.extname(file.filename).toLowerCase();
        const contentType = file.mime_type || MIME_TYPES[ext] || "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", file.size);
        res.setHeader("Cache-Control", "public, max-age=31536000, stale-while-revalidate=86400, immutable");

        if (req.method === "HEAD") {
          return res.status(200).end();
        }

        const buffer = Buffer.from(file.data_base64, "base64");
        return res.status(200).end(buffer);
      }
    } catch (dbErr) {
      console.warn("[api/uploads] DB lookup failed, falling back to disk:", dbErr.message);
    }

    // 2. Fallback to local disk if available
    try {
      const filePath = folder
        ? path.join(process.cwd(), "public", "uploads", folder, filename)
        : path.join(process.cwd(), "public", "uploads", filename);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        const stat = fs.statSync(filePath);

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

        if (req.method === "HEAD") {
          return res.status(200).end();
        }

        const stream = fs.createReadStream(filePath);
        return stream.pipe(res);
      }
    } catch (fsErr) {
      // Ignored
    }

    return res.status(404).json({ error: "File not found", path: targetPath });
  } catch (err) {
    console.error("[api/uploads] Error serving file:", err);
    return res.status(500).json({ error: "Internal server error", message: err.message });
  }
}
