import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const uploadRouter = Router();

const ALLOWED_FOLDERS = ['hero-banners', 'schemes', 'branding', 'circulars', 'webstore-assets'];

uploadRouter.post('/', async (req, res, next) => {
  try {
    const { filename, fileType, dataUrl, base64, folder = 'webstore-assets' } = req.body || {};

    const rawData = dataUrl || base64;
    if (!rawData) {
      return res.status(400).json({ ok: false, error: 'File data (dataUrl or base64) is required.' });
    }

    if (!filename) {
      return res.status(400).json({ ok: false, error: 'Filename is required.' });
    }

    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'webstore-assets';
    // When running from backend/ or root
    const rootDir = process.cwd().endsWith('backend') ? path.join(process.cwd(), '..') : process.cwd();
    const uploadDir = path.join(rootDir, 'public', 'uploads', safeFolder);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${nameWithoutExt}-${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    let base64String = rawData;
    if (rawData.includes(',')) {
      base64String = rawData.split(',')[1];
    }

    const buffer = Buffer.from(base64String, 'base64');
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeFolder}/${uniqueName}`;

    return res.json({
      ok: true,
      url: publicUrl,
      filename: uniqueName,
      originalName: filename,
      size: buffer.length,
      fileType: fileType || 'application/octet-stream',
    });
  } catch (err) {
    next(err);
  }
});
