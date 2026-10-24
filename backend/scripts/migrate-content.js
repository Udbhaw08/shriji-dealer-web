import { sql } from '../src/db/pool.js';

async function main() {
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.store_content (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'hero_banner', 'scheme', 'branding', 'video'
        title TEXT NOT NULL,
        subtitle TEXT DEFAULT '',
        badge TEXT DEFAULT '',
        image_url TEXT,
        file_url TEXT,
        video_url TEXT,
        link_url TEXT,
        bg_color TEXT DEFAULT '#0110a7',
        display_order INT DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_store_content_type_active ON public.store_content (type, is_active, display_order);
    `);
    console.log('✓ public.store_content table successfully created/verified.');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
