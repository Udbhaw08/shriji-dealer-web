import { sql } from '../src/db/pool.js';

async function main() {
  try {
    const bucketsToCreate = ['hero-banners', 'schemes', 'branding', 'webstore-assets'];

    for (const b of bucketsToCreate) {
      await sql`
        INSERT INTO storage.buckets (id, name, public)
        VALUES (${b}, ${b}, true)
        ON CONFLICT (id) DO UPDATE SET public = true;
      `;
      console.log(`✓ Bucket "${b}" configured (public: true)`);
    }

    const currentBuckets = await sql`SELECT id, name, public FROM storage.buckets;`;
    console.log('Current buckets in Supabase:', currentBuckets);
  } catch (err) {
    console.error('Bucket creation error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
