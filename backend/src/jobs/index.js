import { POLL_INTERVAL_MS, crmPoll } from './crmPoll.js';
import { catalogSync, tokenCleanup } from './catalogSync.js';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

const CATALOG_INTERVAL_MS = env.catalogTtlMinutes * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startJobs() {
  if (!env.enableJobs) {
    log.info('[jobs] disabled (ENABLE_JOBS=false)');
    return;
  }
  const every = (ms, fn, name) => {
    fn().catch((err) => log.error(`[jobs:${name}] initial run failed:`, err.message));
    setInterval(() => fn().catch((err) => log.error(`[jobs:${name}] failed:`, err.message)), ms);
    log.info(`[jobs] ${name} every ${Math.round(ms / 60000)} min`);
  };
  every(POLL_INTERVAL_MS, crmPoll, 'crmPoll');
  every(CATALOG_INTERVAL_MS, catalogSync, 'catalogSync');
  every(CLEANUP_INTERVAL_MS, tokenCleanup, 'tokenCleanup');
}
