import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { sql } from '../db/pool.js';

export const uploadsRouter = Router();

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.json': 'application/json',
};

uploadsRouter.get(['/:folder/:filename', '/:filename', '/'], async (req, res, next) => {
  try {
    let folder = req.params.folder || '';
    let filename = req.params.filename || '';

    if (!filename && req.query.path) {
      const parts = String(req.query.path).replace(/^\/+/, '').split('/');
      if (parts.length >= 2) {
        folder = parts[0];
        filename = parts.slice(1).join('/');
      } else {
        filename = parts[0];
      }
    } else if (!filename && req.query.file) {
      filename = String(req.query.file);
      folder = req.query.folder ? String(req.query.folder) : folder;
    }

    if (!filename) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // 1. Fetch from Supabase Postgres
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
        const contentType = file.mime_type || MIME_TYPES[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', file.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const buffer = Buffer.from(file.data_base64, 'base64');
        return res.end(buffer);
      }
    } catch (dbErr) {
      console.warn('[backend/uploads] DB lookup failed, trying disk:', dbErr.message);
    }

    // 2. Disk fallback
    try {
      const rootDir = process.cwd().endsWith('backend') ? path.join(process.cwd(), '..') : process.cwd();
      const filePath = folder
        ? path.join(rootDir, 'public', 'uploads', folder, filename)
        : path.join(rootDir, 'public', 'uploads', filename);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const stat = fs.statSync(filePath);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const stream = fs.createReadStream(filePath);
        return stream.pipe(res);
      }
    } catch (fsErr) {
      // Ignored
    }

    return res.status(404).json({ error: 'File not found' });
  } catch (err) {
    next(err);
  }
});
