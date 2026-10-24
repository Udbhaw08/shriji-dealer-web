import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { sql } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

import express from 'express';
export const uploadRouter = Router();
uploadRouter.use(express.json({ limit: '50mb' }));

const ALLOWED_FOLDERS = ['hero-banners', 'banners', 'schemes', 'branding', 'circulars', 'webstore-assets', 'products'];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const SAFE_EXTENSIONS = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

/**
 * Validates file magic bytes against the declared extension.
 */
function validateMagicBytes(ext, buffer) {
  if (!buffer || buffer.length < 4) return false;

  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === '.png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (ext === '.webp') {
    return (
      buffer.length >= 12 &&
      buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
      buffer.slice(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (ext === '.pdf') {
    return buffer.slice(0, 4).toString('ascii') === '%PDF';
  }
  if (ext === '.mp4') {
    return buffer.length >= 8 && buffer.slice(4, 8).toString('ascii') === 'ftyp';
  }

  return false;
}

uploadRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { filename, dataUrl, base64, folder = 'webstore-assets' } = req.body || {};

    const rawData = dataUrl || base64;
    if (!rawData) {
      return res.status(400).json({ ok: false, error: 'File data is required.' });
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ ok: false, error: 'Filename is required.' });
    }

    if (filename.includes('\0') || filename.includes('..')) {
      return res.status(400).json({ ok: false, error: 'Invalid filename' });
    }

    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'webstore-assets';
    const ext = path.extname(filename).toLowerCase();

    // 1. Strict extension allowlist
    const canonicalMime = SAFE_EXTENSIONS[ext];
    if (!canonicalMime) {
      return res.status(400).json({
        ok: false,
        error: `File type '${ext}' is not permitted. Allowed: ${Object.keys(SAFE_EXTENSIONS).join(', ')}`,
      });
    }

    let base64String = rawData;
    if (rawData.includes(',')) {
      base64String = rawData.split(',')[1];
    }

    const buffer = Buffer.from(base64String, 'base64');

    // 2. Size limit
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        ok: false,
        error: `File size (${buffer.length} bytes) exceeds maximum limit of ${MAX_UPLOAD_BYTES} bytes (25 MB).`,
      });
    }

    // 3. Magic bytes / file signature validation
    if (!validateMagicBytes(ext, buffer)) {
      return res.status(400).json({
        ok: false,
        error: `File signature does not match declared extension '${ext}'. Executable, HTML, or corrupted files are rejected.`,
      });
    }

    // 4. Safe random filename generation
    const uniqueId = crypto.randomUUID().slice(0, 12);
    const uniqueName = `${safeFolder}-${Date.now()}-${uniqueId}${ext}`;

    // 5. Primary Store: Persist in Supabase Postgres
    try {
      await sql`
        INSERT INTO public.uploaded_files (
          id, folder, filename, original_name, mime_type, data_base64, size
        ) VALUES (
          ${uniqueName}, ${safeFolder}, ${uniqueName}, ${path.basename(filename)}, ${canonicalMime}, ${base64String}, ${buffer.length}
        )
        ON CONFLICT (id) DO UPDATE SET
          data_base64 = EXCLUDED.data_base64,
          size = EXCLUDED.size,
          updated_at = NOW();
      `;
    } catch (dbErr) {
      console.error('[backend/upload] Supabase DB insert error:', dbErr);
      throw new Error('Failed to store file in database: ' + dbErr.message);
    }

    // 6. Secondary Cache: Local disk cache if writable (safe against EROFS)
    try {
      const rootDir = process.cwd().endsWith('backend') ? path.join(process.cwd(), '..') : process.cwd();
      const baseUploadDir = path.resolve(rootDir, 'public', 'uploads');
      const uploadDir = path.resolve(baseUploadDir, safeFolder);

      // Verify containment
      const rel = path.relative(baseUploadDir, uploadDir);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.resolve(uploadDir, uniqueName);
        fs.writeFileSync(filePath, buffer);
      }
    } catch (fsErr) {
      // Ignored on read-only environments
    }

    const publicUrl = `/uploads/${safeFolder}/${uniqueName}`;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.json({
      ok: true,
      url: publicUrl,
      filename: uniqueName,
      originalName: path.basename(filename),
      size: buffer.length,
      fileType: canonicalMime,
    });
  } catch (err) {
    next(err);
  }
});
