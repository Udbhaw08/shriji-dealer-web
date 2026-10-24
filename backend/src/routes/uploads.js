import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { sql } from '../db/pool.js';

export const uploadsRouter = Router();

const ALLOWED_FOLDERS = ['hero-banners', 'banners', 'schemes', 'branding', 'circulars', 'webstore-assets', 'products'];

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

uploadsRouter.get(['/:folder/:filename', '/:filename', '/'], async (req, res, next) => {
  try {
    let folder = req.params.folder || '';
    let filename = req.params.filename || '';

    if (!filename && req.query.path) {
      const cleanQ = String(req.query.path).replace(/^\/+/, '');
      const parts = cleanQ.split('/').filter(Boolean);
      if (parts.length >= 2) {
        folder = parts[0];
        filename = parts.slice(1).join('/');
      } else {
        filename = parts[0] || '';
      }
    } else if (!filename && req.query.file) {
      filename = String(req.query.file);
      folder = req.query.folder ? String(req.query.folder) : folder;
    }

    // Reject null bytes or traversal attempts immediately
    if (folder.includes('\0') || filename.includes('\0') || folder.includes('..') || filename.includes('..')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Sanitize folder: must be one of the explicitly allowed folders or empty
    if (folder && !ALLOWED_FOLDERS.includes(folder)) {
      return res.status(403).json({ error: 'Access denied: invalid folder' });
    }

    // Strip directory traversal components from filename
    filename = path.basename(filename);

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
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const buffer = Buffer.from(file.data_base64, 'base64');
        return res.end(buffer);
      }
    } catch (dbErr) {
      // DB lookup failed or unavailable, fallback to disk
    }

    // 2. Disk fallback strictly confined within public/uploads
    try {
      const rootDir = process.cwd().endsWith('backend') ? path.join(process.cwd(), '..') : process.cwd();
      const baseUploadDir = path.resolve(rootDir, 'public', 'uploads');

      const targetPath = folder
        ? path.resolve(baseUploadDir, folder, filename)
        : path.resolve(baseUploadDir, filename);

      // Verify containment using path.relative
      const rel = path.relative(baseUploadDir, targetPath);
      if (rel.startsWith('..') || path.isAbsolute(rel) || targetPath === baseUploadDir) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (fs.existsSync(targetPath)) {
        // Verify realpath to prevent symlink traversal
        const real = fs.realpathSync(targetPath);
        const realRel = path.relative(baseUploadDir, real);
        if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const stat = fs.statSync(real);
        if (!stat.isFile()) {
          return res.status(403).json({ error: 'Access denied' });
        }

        const ext = path.extname(real).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        const stream = fs.createReadStream(real);
        return stream.pipe(res);
      }
    } catch (fsErr) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(404).json({ error: 'File not found' });
  } catch (err) {
    next(err);
  }
});
