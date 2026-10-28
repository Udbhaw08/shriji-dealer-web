import { sql } from '../db/pool.js';

export function formatGoogleDriveUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  // If it's a Google Drive link
  if (trimmed.includes('drive.google.com')) {
    // Extract file ID: e.g. /d/FILE_ID/ or id=FILE_ID
    const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const fileId = match[1];
      return {
        original: trimmed,
        fileId,
        previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        directStreamUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
        isDrive: true,
      };
    }
  }
  return {
    original: trimmed,
    previewUrl: trimmed,
    directStreamUrl: trimmed,
    isDrive: false,
  };
}

export async function getActiveContent(type = null) {
  try {
    const rows = type
      ? await sql`
          SELECT * FROM public.store_content
          WHERE type = ${type} AND is_active = true
          ORDER BY display_order ASC, created_at DESC;
        `
      : await sql`
          SELECT * FROM public.store_content
          WHERE is_active = true
          ORDER BY type ASC, display_order ASC;
        `;
    return rows;
  } catch (err) {
    console.warn(`[Supabase Content] Could not fetch ${type || 'all'} content:`, err.message);
    return [];
  }
}

export async function getHeroSliderSettings() {
  try {
    const rows = await sql`
      SELECT metadata FROM public.store_content
      WHERE type = 'setting' AND id = 'hero_slider_settings'
      LIMIT 1;
    `;
    const meta = rows[0]?.metadata || {};
    return {
      autoplay_interval: Number(meta.autoplay_interval) || 5,
      autoplay_enabled: meta.autoplay_enabled !== false,
      pause_on_hover: meta.pause_on_hover !== false,
      tagline: meta.tagline || meta.home_tagline || "Delivering the heart of every kitchen",
    };
  } catch (err) {
    console.warn('[Supabase Content] Could not fetch slider settings:', err.message);
    return {
      autoplay_interval: 5,
      autoplay_enabled: true,
      pause_on_hover: true,
      tagline: "Delivering the heart of every kitchen",
    };
  }
}

export async function saveHeroSliderSettings(settings = {}) {
  const meta = {
    autoplay_interval: Math.max(2, Math.min(120, Number(settings.autoplay_interval) || 5)),
    autoplay_enabled: settings.autoplay_enabled !== false,
    pause_on_hover: settings.pause_on_hover !== false,
    tagline: settings.tagline ? String(settings.tagline).trim() : undefined,
    updated_at: new Date().toISOString(),
  };

  const rows = await sql`
    INSERT INTO public.store_content (
      id, type, title, subtitle, badge, image_url, file_url, video_url, link_url, bg_color, display_order, is_active, metadata, updated_at
    ) VALUES (
      'hero_slider_settings', 'setting', 'Hero Carousel Settings', 'Slider Autoplay Configuration', '', null, null, null, null, '#000000', 999, true, ${meta}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING *;
  `;
  return rows[0]?.metadata || meta;
}

export async function getSupabaseBanners() {
  const rows = await getActiveContent('hero_banner');
  const sliderSettings = await getHeroSliderSettings();
  const defaultInterval = sliderSettings.autoplay_interval || 5;

  return rows.map((r) => {
    const driveInfo = r.video_url ? formatGoogleDriveUrl(r.video_url) : null;
    const meta = r.metadata || {};
    const durationSeconds = Number(meta.duration_seconds) || defaultInterval;

    return {
      id: r.id,
      src: r.image_url,
      alt: r.title,
      title: r.title,
      subtitle: r.subtitle || '',
      bgColor: r.bg_color || '#0110a7',
      link: r.link_url || '/products',
      videoUrl: r.video_url || null,
      video_url: r.video_url || null,
      driveVideo: driveInfo?.isDrive ? driveInfo : null,
      order: r.display_order || 1,
      duration_seconds: durationSeconds,
      duration: durationSeconds,
      source: 'supabase',
      metadata: meta,
    };
  });
}

export async function getSupabaseSchemes() {
  const rows = await getActiveContent('scheme');
  const active = rows.map((r) => {
    const meta = r.metadata || {};
    const driveInfo = r.video_url ? formatGoogleDriveUrl(r.video_url) : null;
    const flyer = r.image_url || '/img/scheme-annual-business-2026.jpg';
    const pdfUrl = r.file_url || flyer;
    const pdfName = meta.pdf_filename || `${r.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    return {
      id: r.id,
      title: r.title,
      badge: r.badge || 'Dealer Exclusive',
      when: r.subtitle || 'Active Dealer Scheme',
      blurb: meta.blurb || r.subtitle || 'Exclusive promotional scheme on selected Sunshine models.',
      tagline: meta.tagline || 'Celebrate More. Earn More.',
      flyer,
      pdfUrl,
      pdfName,
      videoUrl: r.video_url || null,
      driveVideo: driveInfo?.isDrive ? driveInfo : null,
      link: r.link_url || null,
      status: 'active',
      source: 'supabase',
      daysLeft: meta.daysLeft || null,
      slabs: meta.slabs || [],
      terms: meta.terms || [],
      whatsappBooking: meta.whatsapp_booking || null,
      metadata: meta,
    };
  });

  return {
    active,
    upcoming: [],
    past: [],
  };
}

export async function getSupabaseBranding() {
  const rows = await getActiveContent('branding');
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    imageUrl: r.image_url,
    linkUrl: r.link_url || '/',
    metadata: r.metadata || {},
    source: 'supabase',
  }));
}

export async function getAllStoreContent(type = null) {
  try {
    const rows = type
      ? await sql`
          SELECT * FROM public.store_content
          WHERE type = ${type}
          ORDER BY display_order ASC, created_at DESC;
        `
      : await sql`
          SELECT * FROM public.store_content
          ORDER BY type ASC, display_order ASC, created_at DESC;
        `;
    return rows;
  } catch (err) {
    console.warn(`[Supabase Content] Could not fetch all content:`, err.message);
    return [];
  }
}

export async function upsertStoreContent(item) {
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
  } = item;

  const rows = await sql`
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
  return rows[0];
}

export async function deleteStoreContent(id) {
  const rows = await sql`
    DELETE FROM public.store_content
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] || null;
}

export async function toggleStoreContentActive(id) {
  const rows = await sql`
    UPDATE public.store_content
    SET is_active = NOT is_active, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *;
  `;
  return rows[0] || null;
}

