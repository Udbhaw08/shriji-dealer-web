import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Source paths of generated assets in the agent brain
const BRAIN_DIR = 'C:\\Users\\udbha\\.gemini\\antigravity-ide\\brain\\9b3100ba-3dbd-46be-a2d2-bc1665714d19';

const IMAGES = [
  {
    src: path.join(BRAIN_DIR, 'restor_hero_hob_luxury_1792700032817.jpg'),
    destName: 'restor-hero-hob-luxury.jpg',
    folder: 'hero-banners',
    mime: 'image/jpeg',
  },
  {
    src: path.join(BRAIN_DIR, 'restor_hero_chimney_clean_1792700049425.jpg'),
    destName: 'restor-hero-chimney-smart.jpg',
    folder: 'hero-banners',
    mime: 'image/jpeg',
  },
  {
    src: path.join(BRAIN_DIR, 'restor_hero_suite_kitchen_1792700065973.jpg'),
    destName: 'restor-hero-integrated-suite.jpg',
    folder: 'hero-banners',
    mime: 'image/jpeg',
  },
  {
    src: path.join(BRAIN_DIR, 'restor_scheme_launch_flyer_1792700102956.jpg'),
    destName: 'restor-scheme-annual-flyer.jpg',
    folder: 'schemes',
    mime: 'image/jpeg',
  },
];

async function syncAll() {
  console.log('🔄 Starting ReSTOR Hero Banners & Schemes Supabase Sync...');

  // 1. Copy files to local public directories
  const imgDir = path.join(PROJECT_ROOT, 'public', 'img');
  const uploadsDir = path.join(PROJECT_ROOT, 'public', 'uploads');
  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

  for (const item of IMAGES) {
    if (!fs.existsSync(item.src)) {
      throw new Error(`Source file missing: ${item.src}`);
    }

    const localImgPath = path.join(imgDir, item.destName);
    fs.copyFileSync(item.src, localImgPath);
    console.log(`✓ Copied ${item.destName} to public/img`);

    const folderUploadsDir = path.join(uploadsDir, item.folder);
    if (!fs.existsSync(folderUploadsDir)) fs.mkdirSync(folderUploadsDir, { recursive: true });
    fs.copyFileSync(item.src, path.join(folderUploadsDir, item.destName));
    console.log(`✓ Copied ${item.destName} to public/uploads/${item.folder}`);

    // Read buffer & upload to Supabase public.uploaded_files
    const buffer = fs.readFileSync(item.src);
    const base64String = buffer.toString('base64');

    await sql`
      INSERT INTO public.uploaded_files (
        id, folder, filename, original_name, mime_type, data_base64, size
      ) VALUES (
        ${item.destName}, ${item.folder}, ${item.destName}, ${item.destName}, ${item.mime}, ${base64String}, ${buffer.length}
      )
      ON CONFLICT (id) DO UPDATE SET
        data_base64 = EXCLUDED.data_base64,
        size = EXCLUDED.size,
        updated_at = NOW();
    `;
    console.log(`✓ Synced ${item.destName} into Supabase public.uploaded_files (${buffer.length} bytes)`);
  }

  // 2. Also ensure existing flyer 02_Scheme_Flyer_Image is in uploaded_files
  const existingFlyer = path.join(imgDir, '02_Scheme_Flyer_Image.jpg');
  if (fs.existsSync(existingFlyer)) {
    const buffer = fs.readFileSync(existingFlyer);
    await sql`
      INSERT INTO public.uploaded_files (
        id, folder, filename, original_name, mime_type, data_base64, size
      ) VALUES (
        '02_Scheme_Flyer_Image.jpg', 'schemes', '02_Scheme_Flyer_Image.jpg', '02_Scheme_Flyer_Image.jpg', 'image/jpeg', ${buffer.toString('base64')}, ${buffer.length}
      )
      ON CONFLICT (id) DO UPDATE SET
        data_base64 = EXCLUDED.data_base64,
        size = EXCLUDED.size,
        updated_at = NOW();
    `;
    console.log(`✓ Verified 02_Scheme_Flyer_Image.jpg in public.uploaded_files`);
  }

  // 3. Remove existing hero banners and schemes from public.store_content
  console.log('🗑️ Removing old hero banners and schemes from Supabase public.store_content...');
  await sql`
    DELETE FROM public.store_content
    WHERE type IN ('hero_banner', 'scheme');
  `;
  console.log('✓ Old hero banners and schemes removed.');

  // 4. Insert 3 brand new Sunshine ReSTOR Hero Banners
  console.log('✨ Inserting 3 new Sunshine ReSTOR Hero Banners...');
  const banners = [
    {
      id: 'hero-restor-hob-luxury',
      type: 'hero_banner',
      title: 'Sunshine ReSTOR — Luxury Built-in Hob Series',
      subtitle: 'Engineered with Italian Beveled Tempered Glass & High-Output Forged Brass Burners. Uncompromising Culinary Precision.',
      image_url: '/img/restor-hero-hob-luxury.jpg',
      link_url: '/products',
      bg_color: '#0c1926',
      display_order: 1,
      is_active: true,
      metadata: {
        alt: 'Sunshine ReSTOR Luxury Built-in Hob',
        duration_seconds: 6,
        badge: 'Flagship Built-in',
        tagline: 'Precision Flame. Pure Glass.',
        category: 'Hobs',
        button_text: 'Explore Hobs',
      },
    },
    {
      id: 'hero-restor-chimney-smart',
      type: 'hero_banner',
      title: 'Sunshine ReSTOR — Smart BLDC Chimney Hood',
      subtitle: 'Whisper-Quiet BLDC Inverter Technology, Motion-Sensor Wave Controls & High-Efficiency Thermal Auto-Clean.',
      image_url: '/img/restor-hero-chimney-smart.jpg',
      link_url: '/products',
      bg_color: '#0b1a2a',
      display_order: 2,
      is_active: true,
      metadata: {
        alt: 'Sunshine ReSTOR Smart BLDC Kitchen Chimney',
        duration_seconds: 6,
        badge: 'BLDC Inverter Suction',
        tagline: 'Superior Power. Sleek Design.',
        category: 'Chimneys',
        button_text: 'Explore Chimneys',
      },
    },
    {
      id: 'hero-restor-integrated-suite',
      type: 'hero_banner',
      title: 'Sunshine ReSTOR — The Complete Built-in Suite',
      subtitle: 'Reimagine Your Modern Kitchen. Architecturally Integrated Hobs, Ovens & Silent Ventilation for Discerning Homes.',
      image_url: '/img/restor-hero-integrated-suite.jpg',
      link_url: '/products',
      bg_color: '#132030',
      display_order: 3,
      is_active: true,
      metadata: {
        alt: 'Sunshine ReSTOR Complete Built-in Suite',
        duration_seconds: 6,
        badge: 'Architectural Collection',
        tagline: 'Reimagine. Rebuild. Restart.',
        category: 'All',
        button_text: 'View Collection',
      },
    },
  ];

  for (const b of banners) {
    await sql`
      INSERT INTO public.store_content (
        id, type, title, subtitle, image_url, link_url, bg_color, display_order, is_active, metadata, updated_at
      ) VALUES (
        ${b.id}, ${b.type}, ${b.title}, ${b.subtitle}, ${b.image_url}, ${b.link_url}, ${b.bg_color}, ${b.display_order}, ${b.is_active}, ${b.metadata}, NOW()
      );
    `;
    console.log(`✓ Inserted Hero Banner: ${b.title}`);
  }

  // 5. Insert 2 complete, detailed Dealer Schemes
  console.log('📋 Inserting 2 comprehensive Dealer Schemes with all details...');
  const schemes = [
    {
      id: 'scheme-festive-5-1-bonanza',
      type: 'scheme',
      title: 'Sunshine Festive 5+1 Bonanza Cooktop Offer',
      subtitle: 'Valid 01 Oct 2026 – 31 Dec 2026 | Across India Authorized Dealers',
      badge: 'Dealer Exclusive',
      image_url: '/img/02_Scheme_Flyer_Image.jpg',
      file_url: '/downloads/03_Scheme_Official_Circular.pdf',
      video_url: 'https://drive.google.com/file/d/1B6mY2tM_demo_scheme/preview',
      link_url: 'https://wa.me/919820012345?text=Hi%20Shriji%20Team%2C%20I%20want%20to%20book%20the%20Festive%205%2B1%20Bonanza%20Scheme',
      display_order: 1,
      is_active: true,
      metadata: {
        tagline: 'Celebrate More. Earn More. Expand Your Dealer Margins.',
        blurb: 'Exclusive dealer wholesale scheme: Purchase any 5 Sunshine Heavy-Duty Gas Stoves or Glass Cooktops in a single billing cycle and receive 1 unit completely Free, along with official 5-year warranty coverage and dealer reward club points.',
        pdf_filename: 'Sunshine_Festive_5_1_Official_Circular.pdf',
        daysLeft: 'Valid Till 31 Dec 2026',
        slabs: [
          'Slab 1 (5 Units): Buy any 5 Sunshine Cooktops -> Receive 1 unit completely FREE (20% bonus inventory margin)',
          'Slab 2 (10 Units): Buy 10 Sunshine Cooktops -> Receive 2 FREE Units + 500 Sunshine Dealer Reward Club Points',
          'Slab 3 (25+ Units): Buy 25 Sunshine Cooktops -> Receive 6 FREE Units + Annual Dealer Meet VIP Pass',
        ],
        terms: [
          'Valid strictly for verified GST-registered Sunshine authorized dealers.',
          'Free unit model will match the highest-volume SKU ordered in the qualifying invoice.',
          'Payment terms: Standard 30-day dealer credit or 2% instant cash discount on immediate settlement.',
          'Official manufacturer warranty applies to both purchased and free units without restriction.',
          'Offer valid while quarterly promotional allocated stock lasts.',
        ],
        whatsapp_booking: 'Hi Shriji Team, I would like to book the Festive 5+1 Bonanza Cooktop Offer for my store.',
      },
    },
    {
      id: 'scheme-restor-annual-launch-2026',
      type: 'scheme',
      title: 'Sunshine ReSTOR Annual Dealer Scheme FY 2026-27',
      subtitle: 'Valid 01 Nov 2026 – 31 Mar 2027 | Premium Appliance Partners',
      badge: 'Annual Milestone',
      image_url: '/img/restor-scheme-annual-flyer.jpg',
      file_url: '/downloads/Sunshine-Annual-Business-Scheme-FY26-27.pdf',
      video_url: 'https://drive.google.com/file/d/1B6mY2tM_demo_scheme/preview',
      link_url: 'https://wa.me/919820012345?text=Hi%20Shriji%20Team%2C%20I%20want%20to%20book%20the%20ReSTOR%20Annual%20Business%20Scheme',
      display_order: 2,
      is_active: true,
      metadata: {
        tagline: 'Partnering for Success | Driving Growth Together',
        blurb: 'Official ReSTOR built-in series dealer scheme: Tiered turnover rebate slabs up to 8.5% on qualifying purchases of ReSTOR Built-in Hobs, BLDC Chimneys, and Integrated Kitchen Appliances with complimentary showroom merchandising displays and priority logistics.',
        pdf_filename: 'Sunshine_ReSTOR_Annual_Business_Scheme_FY26-27.pdf',
        daysLeft: 'Valid Till 31 Mar 2027',
        slabs: [
          'Slab 1 (Target ₹2,50,000): 4.0% Direct Turnover Rebate + ReSTOR Counter POP Merchandising Kit',
          'Slab 2 (Target ₹5,00,000): 6.0% Direct Turnover Rebate + Custom Backlit Acrylic ReSTOR Display Unit',
          'Slab 3 (Target ₹10,00,000+): 8.5% Direct Turnover Rebate + Fully Sponsored Executive Dealer Retreat',
        ],
        terms: [
          'Applicable across all Sunshine ReSTOR Built-in series SKUs (Hobs, Chimneys, Ovens, Microwaves).',
          'Quarterly turnover audit and settlement directly credited to dealer credit ledger.',
          'Complimentary showroom display installation provided by certified company engineers.',
          'Priority 24-hour dispatch from central regional mother warehouses.',
          'Requires active dealer account in good standing with zero overdue balance.',
        ],
        whatsapp_booking: 'Hi Shriji Team, I would like to enroll my store in the Sunshine ReSTOR Annual Dealer Scheme FY 2026-27.',
      },
    },
  ];

  for (const s of schemes) {
    await sql`
      INSERT INTO public.store_content (
        id, type, title, subtitle, badge, image_url, file_url, video_url, link_url, display_order, is_active, metadata, updated_at
      ) VALUES (
        ${s.id}, ${s.type}, ${s.title}, ${s.subtitle}, ${s.badge}, ${s.image_url}, ${s.file_url}, ${s.video_url}, ${s.link_url}, ${s.display_order}, ${s.is_active}, ${s.metadata}, NOW()
      );
    `;
    console.log(`✓ Inserted Dealer Scheme: ${s.title}`);
  }

  // 6. Ensure slider settings are active
  await sql`
    INSERT INTO public.store_content (
      id, type, title, subtitle, badge, image_url, file_url, video_url, link_url, bg_color, display_order, is_active, metadata, updated_at
    ) VALUES (
      'hero_slider_settings', 'setting', 'Hero Carousel Settings', 'Slider Autoplay Configuration', '', null, null, null, null, '#000000', 999, true,
      ${{ autoplay_interval: 6, autoplay_enabled: true, pause_on_hover: true }}, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      metadata = EXCLUDED.metadata,
      updated_at = NOW();
  `;
  console.log('✓ Configured hero_slider_settings in Supabase.');

  console.log('\n🎉 ALL DONE! 3 ReSTOR Hero Banners & 2 Detailed Schemes successfully synced with Supabase!');
}

syncAll()
  .catch((err) => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  })
  .finally(() => {
    sql.end();
  });
