import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sql } from "../backend/src/db/pool.js";
import { verifyAdminAuth } from "./_lib/adminAuth.js";

const ALLOWED_FOLDERS = ["hero-banners", "banners", "schemes", "branding", "circulars", "webstore-assets", "products"];

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mp4"]);
const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

function validateMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (ext === ".jpg" || ext === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 89 50 4E 47
  if (ext === ".png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  // WebP: RIFF .... WEBP
  if (ext === ".webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  // PDF: %PDF
  if (ext === ".pdf") {
    return buffer.toString("ascii", 0, 4) === "%PDF";
  }
  // MP4: ftyp at offset 4
  if (ext === ".mp4") {
    return buffer.length >= 8 && buffer.toString("ascii", 4, 8) === "ftyp";
  }
  return false;
}

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // =========================================================================
  // 1. GET / HEAD: Serve files (from Supabase DB primary, local disk fallback)
  // =========================================================================
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      let rawPath = req.query.path || req.query.file || "";
      if (Array.isArray(rawPath)) rawPath = rawPath.join("/");

      if (!rawPath && req.query.folder && req.query.name) {
        rawPath = `${req.query.folder}/${req.query.name}`;
      }

      if (!rawPath || typeof rawPath !== "string") {
        return res.status(400).json({ error: "File path or name is required" });
      }

      // Traversal sanitization
      const decodedPath = decodeURIComponent(rawPath).replace(/\\/g, "/");
      const parts = decodedPath.split("/").filter(p => p && p !== ".");

      if (parts.some(p => p === "..")) {
        return res.status(403).json({ error: "Directory traversal rejected" });
      }

      let folder = "";
      let filename = "";

      if (parts.length >= 2) {
        folder = parts[0];
        filename = path.basename(parts.slice(1).join("/"));
      } else if (parts.length === 1) {
        filename = path.basename(parts[0]);
      }

      if (!filename) {
        return res.status(400).json({ error: "File name is required" });
      }

      if (folder && !ALLOWED_FOLDERS.includes(folder)) {
        return res.status(400).json({ error: "Invalid upload category folder" });
      }

      const ext = path.extname(filename).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      // 1A. Fetch from Supabase PostgreSQL
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
          const outContentType = file.mime_type && ALLOWED_EXTENSIONS.has(path.extname(file.filename).toLowerCase())
            ? file.mime_type
            : contentType;

          res.setHeader("Content-Type", outContentType);
          res.setHeader("Content-Length", file.size);
          res.setHeader("X-Content-Type-Options", "nosniff");
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

      // 1B. Fallback to local disk with strict containment check
      try {
        const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
        const candidatePath = folder
          ? path.resolve(uploadsRoot, folder, filename)
          : path.resolve(uploadsRoot, filename);

        const rel = path.relative(uploadsRoot, candidatePath);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
          return res.status(403).json({ error: "Directory traversal rejected" });
        }

        if (fs.existsSync(candidatePath)) {
          const realPath = fs.realpathSync(candidatePath);
          const realRel = path.relative(uploadsRoot, realPath);
          if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
            return res.status(403).json({ error: "Access denied" });
          }

          const stat = fs.statSync(realPath);
          if (stat.isFile()) {
            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Length", stat.size);
            res.setHeader("X-Content-Type-Options", "nosniff");
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

            if (req.method === "HEAD") {
              return res.status(200).end();
            }

            const stream = fs.createReadStream(realPath);
            return stream.pipe(res);
          }
        }
      } catch (fsErr) {
        console.warn("[api/upload] Disk read failed:", fsErr.message);
      }

      return res.status(404).json({ error: "File not found", path: rawPath });
    } catch (err) {
      console.error("[api/upload] GET error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  // =========================================================================
  // 2. POST: Upload files (Requires Server-Side Admin Authentication)
  // =========================================================================
  if (req.method === "POST") {
    res.setHeader("Content-Type", "application/json");

    // Enforce administrative authorization
    const authResult = await verifyAdminAuth(req);
    if (!authResult.ok) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized: Admin privileges required for file upload.",
        code: "ADMIN_AUTH_REQUIRED"
      });
    }

    try {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const { filename, fileType, dataUrl, base64, folder = "webstore-assets" } = body || {};

      const rawData = dataUrl || base64;
      if (!rawData) {
        return res.status(400).json({ ok: false, error: "File data (dataUrl or base64) is required." });
      }

      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ ok: false, error: "Filename is required." });
      }

      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          ok: false,
          error: "Unsupported file type. Only JPEG, PNG, WebP, PDF, and MP4 are permitted. Executable and active script formats are strictly forbidden."
        });
      }

      const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "webstore-assets";

      let base64String = rawData;
      if (rawData.includes(",")) {
        base64String = rawData.split(",")[1];
      }

      const buffer = Buffer.from(base64String, "base64");

      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(413).json({
          ok: false,
          error: `File size exceeds the 25MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(2)}MB)`
        });
      }

      // Magic byte signature validation
      if (!validateMagicBytes(buffer, ext)) {
        return res.status(400).json({
          ok: false,
          error: "File content signature does not match the stated file extension."
        });
      }

      const safeMime = MIME_TYPES[ext] || "application/octet-stream";
      const uniqueName = `${crypto.randomUUID()}${ext}`;

      // 2A. Primary Store: Supabase PostgreSQL
      try {
        await sql`
          INSERT INTO public.uploaded_files (
            id, folder, filename, original_name, mime_type, data_base64, size
          ) VALUES (
            ${uniqueName}, ${safeFolder}, ${uniqueName}, ${path.basename(filename)}, ${safeMime}, ${base64String}, ${buffer.length}
          )
          ON CONFLICT (id) DO UPDATE SET
            data_base64 = EXCLUDED.data_base64,
            size = EXCLUDED.size,
            updated_at = NOW();
        `;
      } catch (dbErr) {
        console.error("[api/upload] Supabase DB insert error:", dbErr);
        throw new Error("Failed to store file in database: " + dbErr.message);
      }

      // 2B. Secondary Cache: Local disk cache if writable
      try {
        const uploadDir = path.resolve(process.cwd(), "public", "uploads", safeFolder);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        fs.writeFileSync(path.resolve(uploadDir, uniqueName), buffer);
      } catch (fsErr) {
        // Ignored on read-only serverless filesystems
      }

      const publicUrl = `/uploads/${safeFolder}/${uniqueName}`;

      return res.status(200).json({
        ok: true,
        url: publicUrl,
        filename: uniqueName,
        originalName: path.basename(filename),
        size: buffer.length,
        fileType: safeMime,
      });
    } catch (err) {
      console.error("[api/upload] Upload POST error:", err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed. Use GET or POST." });
}
