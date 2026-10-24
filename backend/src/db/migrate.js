import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql } from './pool.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

async function applied() {
  // bootstrapped here because migration tracking itself needs the table
  await sql`create table if not exists sync_state (key text primary key, value text not null)`;
  const rows = await sql`
    select key from sync_state where key like 'migration:%'`;
  return new Set(rows.map((r) => r.key));
}

export async function migrate() {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const done = await applied();
  for (const file of files) {
    const key = `migration:${file}`;
    if (done.has(key)) continue;
    const body = await readFile(path.join(dir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into sync_state (key, value) values (${key}, ${new Date().toISOString()})`;
    });
    console.log(`[migrate] applied ${file}`);
  }
  console.log('[migrate] up to date');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate().then(
    () => process.exit(0),
    (err) => {
      console.error('[migrate] failed:', err.message);
      process.exit(1);
    },
  );
}
