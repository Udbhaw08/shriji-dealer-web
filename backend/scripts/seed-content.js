import fs from 'fs';
import path from 'path';
import { sql } from '../src/db/pool.js';

const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const ASSETS_SRC = 'C:\\Users\\udbha\\Desktop\\ReStor_Upload_Assets';

async function main() {
  console.log('🚀 Seeding Supabase store_content and configuring buckets...');

  try {
    // 1. Ensure Buckets Exist
    const buckets = ['hero-banners', 'schemes', 'branding', 'webstore-assets'];
    for (const b of buckets) {
      await sql`
        INSERT INTO storage.buckets (id, name, public)
        VALUES (${b}, ${b}, true)
        ON CONFLICT (id) DO UPDATE SET public = true;
      `;
    }
    console.log('✓ Storage buckets verified: hero-banners, schemes, branding, webstore-assets');

    // 2. Ensure Local Public Files exist
    if (fs.existsSync(ASSETS_SRC)) {
      const bannerSrc = path.join(ASSETS_SRC, '01_Hero_Banner_Image.jpg');
      const flyerSrc = path.join(ASSETS_SRC, '02_Scheme_Flyer_Image.jpg');
      const pdfSrc = path.join(ASSETS_SRC, '03_Scheme_Official_Circular.pdf');

      const imgDest = path.join(PROJECT_ROOT, 'public', 'img');
      const dlDest = path.join(PROJECT_ROOT, 'public', 'downloads');
      if (!fs.existsSync(imgDest)) fs.mkdirSync(imgDest, { recursive: true });
      if (!fs.existsSync(dlDest)) fs.mkdirSync(dlDest, { recursive: true });

      if (fs.existsSync(bannerSrc)) {
        fs.copyFileSync(bannerSrc, path.join(imgDest, '01_Hero_Banner_Image.jpg'));
        console.log('✓ Copied 01_Hero_Banner_Image.jpg to public/img');
      }
      if (fs.existsSync(flyerSrc)) {
        fs.copyFileSync(flyerSrc, path.join(imgDest, '02_Scheme_Flyer_Image.jpg'));
        console.log('✓ Copied 02_Scheme_Flyer_Image.jpg to public/img');
      }
      if (fs.existsSync(pdfSrc)) {
        fs.copyFileSync(pdfSrc, path.join(dlDest, '03_Scheme_Official_Circular.pdf'));
        console.log('✓ Copied 03_Scheme_Official_Circular.pdf to public/downloads');
      }
    }

    // 3. Supabase Public CDN Base
    const supabaseStorageBase = 'https://zdcfxgqblhrnuikrzswp.supabase.co/storage/v1/object/public';

    // 4. Seed Content Table
    // A. Hero Banners
    await sql`
      INSERT INTO public.store_content (
        id, type, title, subtitle, image_url, video_url, link_url, bg_color, display_order, is_active, metadata
      ) VALUES (
        'hero-restor-luxury',
        'hero_banner',
        'Sunshine ReSTOR — Luxury Built-in Series',
        'Reimagine, Rebuild, Restart. Premium Built-in Hobs & Low-Noise BLDC Chimneys for Modern Kitchens.',
        '/img/01_Hero_Banner_Image.jpg',
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        '/products',
        '#0110a7',
        1,
        true,
        jsonb_build_object(
          'supabase_storage_url', ${supabaseStorageBase} || '/hero-banners/01_Hero_Banner_Image.jpg',
          'drive_link', 'https://drive.google.com/file/d/1B6mY2tM_demo_banner/preview',
          'alt', 'Sunshine ReSTOR Luxury Launch'
        )
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        image_url = EXCLUDED.image_url,
        video_url = EXCLUDED.video_url,
        link_url = EXCLUDED.link_url,
        bg_color = EXCLUDED.bg_color,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `;

    // B. Schemes (with Flyer, Downloadable PDF, Google Drive video link)
    await sql`
      INSERT INTO public.store_content (
        id, type, title, subtitle, badge, image_url, file_url, video_url, link_url, display_order, is_active, metadata
      ) VALUES (
        'scheme-festive-5-1',
        'scheme',
        'Festive 5+1 Bonanza Cooktop Offer',
        'Valid 01 Sep 2026 – 31 Dec 2026',
        'Dealer Exclusive',
        '/img/02_Scheme_Flyer_Image.jpg',
        '/downloads/03_Scheme_Official_Circular.pdf',
        'https://drive.google.com/file/d/1B6mY2tM_demo_scheme/preview',
        'https://wa.me/919820012345?text=Hi%20Shriji%20Team%2C%20I%20want%20to%20book%20the%20Festive%205%2B1%20Bonanza%20Scheme',
        1,
        true,
        jsonb_build_object(
          'tagline', 'Celebrate More. Earn More.',
          'blurb', 'Exclusive dealer wholesale scheme: Purchase any 5 Sunshine Cooktops and receive 1 unit completely Free along with official warranty and tour achievement points.',
          'pdf_filename', 'Sunshine_Festive_5_1_Official_Circular.pdf',
          'supabase_flyer_url', ${supabaseStorageBase} || '/schemes/02_Scheme_Flyer_Image.jpg',
          'supabase_pdf_url', ${supabaseStorageBase} || '/schemes/03_Scheme_Official_Circular.pdf',
          'drive_link', 'https://drive.google.com/file/d/1B6mY2tM_demo_scheme/preview'
        )
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        badge = EXCLUDED.badge,
        image_url = EXCLUDED.image_url,
        file_url = EXCLUDED.file_url,
        video_url = EXCLUDED.video_url,
        link_url = EXCLUDED.link_url,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `;

    // C. Branding (Logos)
    await sql`
      INSERT INTO public.store_content (
        id, type, title, subtitle, image_url, link_url, display_order, is_active, metadata
      ) VALUES (
        'logo-primary',
        'branding',
        'Sunshine ReSTOR Official Logo',
        'Primary brand header logo',
        '/img/logo.webp',
        '/',
        1,
        true,
        jsonb_build_object(
          'supabase_logo_url', ${supabaseStorageBase} || '/branding/logo.webp',
          'alt', 'Sunshine ReSTOR'
        )
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        image_url = EXCLUDED.image_url,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `;

    // 5. Query and print result
    const seeded = await sql`SELECT id, type, title, image_url, file_url, video_url, is_active FROM public.store_content ORDER BY type, display_order;`;
    console.log('✓ Successfully seeded public.store_content in Supabase:');
    console.table(seeded);

  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await sql.end();
  }
}

main();
