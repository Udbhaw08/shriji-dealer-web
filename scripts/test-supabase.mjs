import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const { sql } = await import('../backend/src/db/pool.js');

async function test() {
  try {
    const buckets = await sql.unsafe('SELECT * FROM storage.buckets;');
    console.log('Buckets:', buckets);
    const tables = await sql.unsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    console.log('Public tables:', tables.map((t) => t.table_name));
  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await sql.end();
  }
}

test();
