import { sql } from '../db/pool.js';
import { syncCatalog } from '../services/catalog.js';
import { log } from '../utils/logger.js';

/** Scheduled catalog refresh (Zoho Commerce → backend cache). Zoho stays master. */
export async function catalogSync() {
  try {
    await syncCatalog();
    try {
      const { syncProductDetailsPool } = await import('../../../api/_lib/zoho.js');
      await syncProductDetailsPool({ batchSize: 15 });
    } catch (poolErr) {
      log.warn('[catalogSync] detail pool sync notice:', poolErr.message);
    }
  } catch (err) {
    log.error('[catalogSync] failed:', err.message);
  }
}

export async function tokenCleanup() {
  const r1 = await sql`
    delete from refresh_tokens where expires_at < now() - interval '7 days' or revoked = true and created_at < now() - interval '30 days'`;
  const r2 = await sql`delete from otp_codes where expires_at < now() - interval '1 day'`;
  if (r1.count || r2.count) log.info(`[tokenCleanup] removed ${r1.count} refresh tokens, ${r2.count} otps`);
}
