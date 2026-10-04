import { sql } from '../db/pool.js';
import { log } from '../utils/logger.js';

/**
 * Notification delivery. Email/WhatsApp providers plug in here later.
 * For now every channel is a structured log line so flows can be tested end-to-end.
 */
export async function notify(userId, channel, template, data = {}) {
  const rows = await sql`select email, phone from users where id = ${userId}`;
  const user = rows[0];
  if (!user) {
    log.warn(`[notify] user ${userId} not found for ${template}`);
    return;
  }
  log.info(`[notify:${channel}] → ${template} to=${channel === 'email' ? user.email : user.phone}`, data);
  // TODO: wire real provider (email first, WhatsApp later) — see docs/BACKEND-ARCHITECTURE.md §2.6
}
