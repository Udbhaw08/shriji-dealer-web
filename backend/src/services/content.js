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

export async function getSupabaseBanners() {
  const rows = await getActiveContent('hero_banner');
  return rows.map((r) => {
    const driveInfo = r.video_url ? formatGoogleDriveUrl(r.video_url) : null;
    return {
      id: r.id,
      src: r.image_url,
      alt: r.title,
      title: r.title,
      subtitle: r.subtitle || '',
      bgColor: r.bg_color || '#0110a7',
      link: r.link_url || '/products',
      videoUrl: r.video_url || null,
      driveVideo: driveInfo?.isDrive ? driveInfo : null,
      order: r.display_order || 1,
      source: 'supabase',
      metadata: r.metadata || {},
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
