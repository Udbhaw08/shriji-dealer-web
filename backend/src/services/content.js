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
      tagline: meta.home_tagline !== undefined ? meta.home_tagline : (meta.tagline || "Delivering the heart of every kitchen"),
      home_tagline: meta.home_tagline !== undefined ? meta.home_tagline : (meta.tagline || "Delivering the heart of every kitchen"),
      home_tagline_enabled: meta.home_tagline_enabled !== false,
      header_tagline_enabled: meta.header_tagline_enabled !== false,
      header_tagline_1: meta.header_tagline_1 !== undefined ? meta.header_tagline_1 : "Better Products",
      header_tagline_2: meta.header_tagline_2 !== undefined ? meta.header_tagline_2 : "Stronger Partners",
      header_tagline_3: meta.header_tagline_3 !== undefined ? meta.header_tagline_3 : "Brighter Homes",
      catalogue_download_url: meta.catalogue_download_url !== undefined ? meta.catalogue_download_url : "/downloads/Sunshine-Range-Brochure-2026.pdf",
      catalogue_title: meta.catalogue_title !== undefined ? meta.catalogue_title : "Looking for Product Catalogues?",
      catalogue_subtitle: meta.catalogue_subtitle !== undefined ? meta.catalogue_subtitle : "Download the official Sunshine 2026 range brochure (PDF)",
      catalogue_enabled: meta.catalogue_enabled !== false,
    };
  } catch (err) {
    console.warn('[Supabase Content] Could not fetch slider settings:', err.message);
    return {
      autoplay_interval: 5,
      autoplay_enabled: true,
      pause_on_hover: true,
      tagline: "Delivering the heart of every kitchen",
      home_tagline: "Delivering the heart of every kitchen",
      home_tagline_enabled: true,
      header_tagline_enabled: true,
      header_tagline_1: "Better Products",
      header_tagline_2: "Stronger Partners",
      header_tagline_3: "Brighter Homes",
      catalogue_download_url: "/downloads/Sunshine-Range-Brochure-2026.pdf",
      catalogue_title: "Looking for Product Catalogues?",
      catalogue_subtitle: "Download the official Sunshine 2026 range brochure (PDF)",
      catalogue_enabled: true,
    };
  }
}

export async function saveHeroSliderSettings(settings = {}) {
  let current = {};
  try {
    const currentRows = await sql`
      SELECT metadata FROM public.store_content
      WHERE type = 'setting' AND id = 'hero_slider_settings'
      LIMIT 1;
    `;
    current = currentRows[0]?.metadata || {};
  } catch {}

  const meta = {
    autoplay_interval: settings.autoplay_interval !== undefined
      ? Math.max(2, Math.min(120, Number(settings.autoplay_interval) || 5))
      : (Number(current.autoplay_interval) || 5),
    autoplay_enabled: settings.autoplay_enabled !== undefined
      ? settings.autoplay_enabled !== false
      : (current.autoplay_enabled !== false),
    pause_on_hover: settings.pause_on_hover !== undefined
      ? settings.pause_on_hover !== false
      : (current.pause_on_hover !== false),
    tagline: settings.home_tagline !== undefined
      ? String(settings.home_tagline).trim()
      : (settings.tagline !== undefined
          ? String(settings.tagline).trim()
          : (current.home_tagline || current.tagline || "Delivering the heart of every kitchen")),
    home_tagline: settings.home_tagline !== undefined
      ? String(settings.home_tagline).trim()
      : (settings.tagline !== undefined
          ? String(settings.tagline).trim()
          : (current.home_tagline || current.tagline || "Delivering the heart of every kitchen")),
    home_tagline_enabled: settings.home_tagline_enabled !== undefined
      ? Boolean(settings.home_tagline_enabled)
      : (current.home_tagline_enabled !== false),
    header_tagline_enabled: settings.header_tagline_enabled !== undefined
      ? Boolean(settings.header_tagline_enabled)
      : (current.header_tagline_enabled !== false),
    header_tagline_1: settings.header_tagline_1 !== undefined
      ? String(settings.header_tagline_1).trim()
      : (current.header_tagline_1 ?? "Better Products"),
    header_tagline_2: settings.header_tagline_2 !== undefined
      ? String(settings.header_tagline_2).trim()
      : (current.header_tagline_2 ?? "Stronger Partners"),
    header_tagline_3: settings.header_tagline_3 !== undefined
      ? String(settings.header_tagline_3).trim()
      : (current.header_tagline_3 ?? "Brighter Homes"),
    catalogue_download_url: settings.catalogue_download_url !== undefined
      ? String(settings.catalogue_download_url).trim()
      : (current.catalogue_download_url ?? "/downloads/Sunshine-Range-Brochure-2026.pdf"),
    catalogue_title: settings.catalogue_title !== undefined
      ? String(settings.catalogue_title).trim()
      : (current.catalogue_title ?? "Looking for Product Catalogues?"),
    catalogue_subtitle: settings.catalogue_subtitle !== undefined
      ? String(settings.catalogue_subtitle).trim()
      : (current.catalogue_subtitle ?? "Download the official Sunshine 2026 range brochure (PDF)"),
    catalogue_enabled: settings.catalogue_enabled !== undefined
      ? Boolean(settings.catalogue_enabled)
      : (current.catalogue_enabled !== false),
    updated_at: new Date().toISOString(),
  };

  const rows = await sql`
    INSERT INTO public.store_content (
      id, type, title, subtitle, badge, image_url, file_url, video_url, link_url, bg_color, display_order, is_active, metadata, updated_at
    ) VALUES (
      'hero_slider_settings', 'setting', 'Site & Carousel Settings', 'Slider & Brand Taglines Configuration', '', null, null, null, null, '#000000', 999, true, ${meta}, NOW()
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
      fitMode: meta.fit_mode || meta.fit || (r.id?.startsWith('hero-restor-') ? 'cover' : 'contain'),
      mobileSrc: meta.mobile_image_url || null,
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

