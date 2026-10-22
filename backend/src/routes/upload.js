import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { sql } from '../db/pool.js';

export const uploadRouter = Router();

const ALLOWED_FOLDERS = ['hero-banners', 'schemes', 'branding', 'circulars', 'webstore-assets'];

uploadRouter.post('/', async (req, res, next) => {
  try {
    const { filename, fileType = 'application/octet-stream', dataUrl, base64, folder = 'webstore-assets' } = req.body || {};

    const rawData = dataUrl || base64;
    if (!rawData) {
      return res.status(400).json({ ok: false, error: 'File data (dataUrl or base64) is required.' });
    }

    if (!filename) {
      return res.status(400).json({ ok: false, error: 'Filename is required.' });
    }

    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'webstore-assets';

    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${nameWithoutExt}-${Date.now()}${ext}`;

    let base64String = rawData;
    if (rawData.includes(',')) {
      base64String = rawData.split(',')[1];
    }

    const buffer = Buffer.from(base64String, 'base64');

    // 1. Primary Store: Persist in Supabase Postgres
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
      console.error('[backend/upload] Supabase DB insert error:', dbErr);
      throw new Error('Failed to store file in Supabase: ' + dbErr.message);
    }

    // 2. Secondary Cache: Local disk cache if writable (safe against EROFS)
    try {
      const rootDir = process.cwd().endsWith('backend') ? path.join(process.cwd(), '..') : process.cwd();
      const uploadDir = path.join(rootDir, 'public', 'uploads', safeFolder);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
    } catch (fsErr) {
      console.log('[backend/upload] Local disk cache skipped (read-only environment):', fsErr.message);
    }

    const publicUrl = `/uploads/${safeFolder}/${uniqueName}`;

    return res.json({
      ok: true,
      url: publicUrl,
      filename: uniqueName,
      originalName: filename,
      size: buffer.length,
      fileType: fileType,
    });
  } catch (err) {
    next(err);
  }
});
