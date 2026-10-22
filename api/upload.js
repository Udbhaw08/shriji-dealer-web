import fs from "fs";
import path from "path";
import { sql } from "../backend/src/db/pool.js";

const ALLOWED_FOLDERS = ["hero-banners", "schemes", "branding", "circulars", "webstore-assets"];

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
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // =========================================================================
  // 1. GET / HEAD: Serve files (from Supabase DB primary, local disk fallback)
  // =========================================================================
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      let targetPath = req.query.path || req.query.file || "";
      if (Array.isArray(targetPath)) targetPath = targetPath.join("/");

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

      // 1A. Fetch from Supabase PostgreSQL (reliable across Vercel read-only serverless environments)
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
        console.warn("[api/upload] DB lookup failed, trying local disk:", dbErr.message);
      }

      // 1B. Fallback to local disk if available
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
        console.warn("[api/upload] Disk read failed:", fsErr.message);
      }

      return res.status(404).json({ error: "File not found", path: targetPath });
    } catch (err) {
      console.error("[api/upload] GET error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // =========================================================================
  // 2. POST: Upload files (persists to Supabase DB + optional local cache)
  // =========================================================================
  if (req.method === "POST") {
    res.setHeader("Content-Type", "application/json");

    try {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const { filename, fileType = "application/octet-stream", dataUrl, base64, folder = "webstore-assets" } = body || {};

      const rawData = dataUrl || base64;
      if (!rawData) {
        return res.status(400).json({ ok: false, error: "File data (dataUrl or base64) is required." });
      }

      if (!filename) {
        return res.status(400).json({ ok: false, error: "Filename is required." });
      }

      const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "webstore-assets";

      const ext = path.extname(filename).toLowerCase();
      const nameWithoutExt = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      const uniqueName = `${nameWithoutExt}-${Date.now()}${ext}`;

      let base64String = rawData;
      if (rawData.includes(",")) {
        base64String = rawData.split(",")[1];
      }

      const buffer = Buffer.from(base64String, "base64");

      // 2A. Primary Store: Supabase PostgreSQL (reliable on Vercel Serverless)
      try {
        await sql`
          INSERT INTO public.uploaded_files (
            id, folder, filename, original_name, mime_type, data_base64, size
          ) VALUES (
            ${uniqueName}, ${safeFolder}, ${uniqueName}, ${filename}, ${fileType}, ${base64String}, ${buffer.length}
          )
          ON CONFLICT (id) DO UPDATE SET
            data_base64 = EXCLUDED.data_base64,
            size = EXCLUDED.size,
            updated_at = NOW();
        `;
      } catch (dbErr) {
        console.error("[api/upload] Supabase DB insert error:", dbErr);
        throw new Error("Failed to store file in Supabase: " + dbErr.message);
      }

      // 2B. Secondary Cache: Local disk cache if writable (safe against EROFS on Vercel)
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadDir, uniqueName), buffer);
      } catch (fsErr) {
        // Ignored on read-only serverless filesystems
      }

      const publicUrl = `/uploads/${safeFolder}/${uniqueName}`;

      return res.status(200).json({
        ok: true,
        url: publicUrl,
        filename: uniqueName,
        originalName: filename,
        size: buffer.length,
        fileType: fileType,
      });
    } catch (err) {
      console.error("[api/upload] Upload POST error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed. Use GET or POST." });
}
