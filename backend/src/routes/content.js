import { Router } from 'express';
import { getSupabaseBanners, getSupabaseSchemes, getSupabaseBranding, getActiveContent } from '../services/content.js';
import { sql } from '../db/pool.js';

export const contentRouter = Router();

// GET /api/content/banners
contentRouter.get('/banners', async (req, res, next) => {
  try {
    const banners = await getSupabaseBanners();
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.json({ ok: true, count: banners.length, banners });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/schemes
contentRouter.get('/schemes', async (req, res, next) => {
  try {
    const schemes = await getSupabaseSchemes();
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.json({ ok: true, schemes });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/branding
contentRouter.get('/branding', async (req, res, next) => {
  try {
    const branding = await getSupabaseBranding();
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.json({ ok: true, branding });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/all
contentRouter.get('/all', async (req, res, next) => {
  try {
    const [banners, schemes, branding] = await Promise.all([
      getSupabaseBanners(),
      getSupabaseSchemes(),
      getSupabaseBranding(),
    ]);
    return res.json({ ok: true, banners, schemes, branding });
  } catch (err) {
    next(err);
  }
});

// POST /api/content (Upsert item in Supabase)
contentRouter.post('/', async (req, res, next) => {
  try {
    const {
      id,
      type,
      title,
      subtitle = '',
      badge = '',
      image_url = null,
      file_url = null,
      video_url = null,
      link_url = null,
      bg_color = '#0110a7',
      display_order = 1,
      is_active = true,
      metadata = {},
    } = req.body;

    if (!id || !type || !title) {
      return res.status(400).json({ error: 'id, type, and title are required.' });
    }

    const inserted = await sql`
      INSERT INTO public.store_content (
        id, type, title, subtitle, badge, image_url, file_url, video_url, link_url, bg_color, display_order, is_active, metadata, updated_at
      ) VALUES (
        ${id}, ${type}, ${title}, ${subtitle}, ${badge}, ${image_url}, ${file_url}, ${video_url}, ${link_url}, ${bg_color}, ${display_order}, ${is_active}, ${metadata}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        badge = EXCLUDED.badge,
        image_url = EXCLUDED.image_url,
        file_url = EXCLUDED.file_url,
        video_url = EXCLUDED.video_url,
        link_url = EXCLUDED.link_url,
        bg_color = EXCLUDED.bg_color,
        display_order = EXCLUDED.display_order,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *;
    `;

    return res.json({ ok: true, item: inserted[0] });
  } catch (err) {
    next(err);
  }
});
