import fs from "fs";
import path from "path";
import { sql } from "../backend/src/db/pool.js";

const ALLOWED_FOLDERS = ["hero-banners", "schemes", "branding", "circulars", "webstore-assets"];

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
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

    const { filename, fileType = "application/octet-stream", dataUrl, base64, folder = "webstore-assets" } = body || {};

    const rawData = dataUrl || base64;
    if (!rawData) {
      return res.status(400).json({ ok: false, error: "File data (dataUrl or base64) is required." });
    }

    if (!filename) {
      return res.status(400).json({ ok: false, error: "Filename is required." });
    }

    // Determine target subfolder
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "webstore-assets";

    // Sanitize filename and create unique identifier
    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueName = `${nameWithoutExt}-${Date.now()}${ext}`;

    // Extract raw base64 payload
    let base64String = rawData;
    if (rawData.includes(",")) {
      base64String = rawData.split(",")[1];
    }

    const buffer = Buffer.from(base64String, "base64");

    // 1. Primary Store: Persist in Supabase Postgres (reliable across all environments, Vercel serverless & local)
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

    // 2. Secondary Cache: Attempt local disk cache if writable (safe against EROFS on Vercel)
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, uniqueName), buffer);
    } catch (fsErr) {
      // Non-fatal on serverless environments where local filesystem is read-only (EROFS)
      console.log("[api/upload] Local disk cache skipped (read-only environment):", fsErr.message);
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
    console.error("[api/upload] File upload error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
