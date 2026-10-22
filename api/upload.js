import fs from "fs";
import path from "path";

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

    const { filename, fileType, dataUrl, base64, folder = "webstore-assets" } = body || {};

    const rawData = dataUrl || base64;
    if (!rawData) {
      return res.status(400).json({ ok: false, error: "File data (dataUrl or base64) is required." });
    }

    if (!filename) {
      return res.status(400).json({ ok: false, error: "Filename is required." });
    }

    // Determine target subfolder
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "webstore-assets";
    const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Sanitize filename
    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueName = `${nameWithoutExt}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Extract base64 payload
    let base64String = rawData;
    if (rawData.includes(",")) {
      base64String = rawData.split(",")[1];
    }

    const buffer = Buffer.from(base64String, "base64");
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeFolder}/${uniqueName}`;

    return res.status(200).json({
      ok: true,
      url: publicUrl,
      filename: uniqueName,
      originalName: filename,
      size: buffer.length,
      fileType: fileType || "application/octet-stream",
    });
  } catch (err) {
    console.error("[api/upload] File upload error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
