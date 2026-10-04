import postgres from 'postgres';
import { env } from '../config/env.js';

export const sql = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
});

export async function tx(fn) {
  return sql.begin(fn);
}
