import { sql } from '../src/db/pool.js';

async function main() {
  try {
    const policies = await sql`
      SELECT policyname, tablename, cmd, qual
      FROM pg_policies
      WHERE schemaname = 'storage';
    `;
    console.log('Storage policies:', policies);

    // Ensure public read policy exists for our buckets
    await sql.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read for webstore assets'
        ) THEN
          CREATE POLICY "Public read for webstore assets"
          ON storage.objects FOR SELECT
          USING (bucket_id IN ('hero-banners', 'schemes', 'branding', 'webstore-assets'));
        END IF;
      END $$;
    `);
    console.log('✓ Public read policy for webstore assets verified.');
  } catch (err) {
    console.error('Policy check error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
