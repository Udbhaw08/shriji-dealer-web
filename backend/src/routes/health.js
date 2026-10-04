import { Router } from 'express';
import { sql } from '../db/pool.js';
import { isCrmConfigured } from '../services/crmClient.js';
import { isCommerceConfigured } from '../services/commerceClient.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let db = 'down';
  let lastCrmPollAt = null;
  try {
    const rows = await sql`select value from sync_state where key = 'last_crm_poll_at'`;
    lastCrmPollAt = rows[0]?.value || null;
    db = 'up';
  } catch { /* reported below */ }
  res.json({
    ok: true,
    db,
    crm_configured: isCrmConfigured(),
    commerce_configured: isCommerceConfigured(),
    last_crm_poll_at: lastCrmPollAt,
    uptime_seconds: Math.round(process.uptime()),
  });
});
