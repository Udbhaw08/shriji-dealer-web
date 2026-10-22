import postgres from 'postgres';
import { env } from '../config/env.js';

const dbUrl = env.databaseUrl;

export const sql = postgres(dbUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: 'require',
  onnotice: () => {},
});

export async function tx(fn) {
  return sql.begin(fn);
}
