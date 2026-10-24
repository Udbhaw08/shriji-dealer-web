import { sql } from '../db/pool.js';

export async function audit(actorId, action, targetType = null, targetId = null, meta = null) {
  try {
    await sql`insert into audit_log (actor_id, action, target_type, target_id, meta)
              values (${actorId}, ${action}, ${targetType}, ${targetId},
                      ${meta ? JSON.stringify(meta) : null})`;
  } catch (err) {
    // audit must never break the request path
    console.error('[audit] failed:', err.message);
  }
}
