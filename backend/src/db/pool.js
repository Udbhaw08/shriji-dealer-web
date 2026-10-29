import postgres from 'postgres';
import { env } from '../config/env.js';

const dbUrl = env.databaseUrl;

function createSafeSql() {
  if (!dbUrl || typeof dbUrl !== 'string' || !dbUrl.trim()) {
    const dummy = async () => [];
    dummy.begin = async (fn) => fn(dummy);
    dummy.end = async () => {};
    return dummy;
  }
  return postgres(dbUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: 'require',
    prepare: false, // Critical for Supabase Connection Pooler (PgBouncer) & Serverless lambdas
    onnotice: () => {},
  });
}

export const sql = createSafeSql();

export async function tx(fn) {
  return typeof sql.begin === 'function' ? sql.begin(fn) : fn(sql);
}
