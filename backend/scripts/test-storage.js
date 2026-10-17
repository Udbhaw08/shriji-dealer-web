import { sql } from '../src/db/pool.js';

async function main() {
  try {
    const buckets = await sql.unsafe('SELECT id, name, public FROM storage.buckets;');
    console.log('Existing Storage Buckets:', buckets);

    const objects = await sql.unsafe('SELECT bucket_id, name FROM storage.objects LIMIT 10;');
    console.log('Sample Storage Objects:', objects);
  } catch (err) {
    console.error('Storage query error:', err.message);
  } finally {
    await sql.end();
  }
}

main();
