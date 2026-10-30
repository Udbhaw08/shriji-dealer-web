import { Router } from 'express';
import {
  getSupabaseBanners,
  getSupabaseSchemes,
  getSupabaseBranding,
  getActiveContent,
  getHeroSliderSettings,
  saveHeroSliderSettings,
} from '../services/content.js';
import { sql } from '../db/pool.js';
import { requireAdmin } from '../middleware/auth.js';

export const contentRouter = Router();

// GET /api/content/banners
contentRouter.get('/banners', async (req, res, next) => {
  try {
    const [banners, settings] = await Promise.all([
      getSupabaseBanners(),
      getHeroSliderSettings(),
    ]);
    res.setHeader('Cache-Control', 'public, max-age=15');
    return res.json({ ok: true, count: banners.length, banners, settings });
  } catch (err) {
    next(err);
  }
});

// GET /api/content/settings/hero and /api/content/settings
contentRouter.get('/settings/hero', async (req, res, next) => {
  try {
    const settings = await getHeroSliderSettings();
    return res.json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
});

contentRouter.get('/settings', async (req, res, next) => {
  try {
    const settings = await getHeroSliderSettings();
    return res.json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
});

// POST /api/content/settings/hero and /api/content/settings (Admin Only)
contentRouter.post('/settings/hero', requireAdmin, async (req, res, next) => {
  try {
    const saved = await saveHeroSliderSettings(req.body);
    return res.json({ ok: true, settings: saved });
  } catch (err) {
    next(err);
  }
});

contentRouter.post('/settings', requireAdmin, async (req, res, next) => {
  try {
    const saved = await saveHeroSliderSettings(req.body);
    return res.json({ ok: true, settings: saved });
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
    const [branding, settings] = await Promise.all([
      getSupabaseBranding(),
      getHeroSliderSettings(),
    ]);
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.json({ ok: true, branding, settings });
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

const ALLOWED_CONTENT_TYPES = ['hero_banner', 'scheme', 'branding', 'setting'];

// POST /api/content (Upsert item in Supabase OR toggle active) (Admin Only)
contentRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    if (req.query.action === 'toggle' || req.body?.action === 'toggle') {
      const id = req.query.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'Item id is required to toggle status.' });
      const updated = await sql`
        UPDATE public.store_content
        SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *;
      `;
      return res.json({ ok: true, item: updated[0] || null });
    }

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

    if (!ALLOWED_CONTENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid content type: ${type}` });
    }

    // Length constraints to prevent database bloat
    if (String(title).length > 200 || String(subtitle).length > 300 || String(badge).length > 100) {
      return res.status(400).json({ error: 'Field length exceeds maximum permitted limit.' });
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

// DELETE /api/content/:id (Admin Only)
contentRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await sql`
      DELETE FROM public.store_content
      WHERE id = ${id}
      RETURNING *;
    `;
    return res.json({ ok: true, deleted: deleted[0] || null });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/content/:id/toggle (Admin Only)
contentRouter.patch('/:id/toggle', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await sql`
      UPDATE public.store_content
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    return res.json({ ok: true, item: updated[0] || null });
  } catch (err) {
    next(err);
  }
});

