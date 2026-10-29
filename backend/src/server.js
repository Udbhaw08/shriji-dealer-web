import app from './app.js';
import { env } from './config/env.js';
import { log } from './utils/logger.js';
import { startJobs } from './jobs/index.js';
import { migrate } from './db/migrate.js';
import { sql } from './db/pool.js';

let server;

async function start() {
  await migrate();
  startJobs();
  server = app.listen(env.port, '0.0.0.0', () => log.info(`[server] listening on :${env.port}`));
}

let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info(`[server] received ${signal}, shutting down gracefully...`);
  if (!server) {
    process.exit(0);
  }
  server.close(async () => {
    try {
      await sql.end({ timeout: 5 });
      log.info('[server] db pool closed');
    } catch (e) {
      log.error('[server] error closing db pool:', e.message);
    }
    process.exit(0);
  });
  setTimeout(() => {
    log.error('[server] forced shutdown timeout expired');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (process.env.NODE_ENV !== 'test' && !process.env.SERVERLESS) {
  start().catch((err) => {
    log.error('[server] failed to start:', err.message);
    process.exit(1);
  });
}

export default app;
