import express from 'express';
import { env } from './config/env.js';
import { log } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { dealersRouter } from './routes/dealers.js';
import { pricesRouter } from './routes/prices.js';
import { webhooksRouter } from './routes/webhooks.js';
import { healthRouter } from './routes/health.js';
import { contentRouter } from './routes/content.js';
import { uploadRouter } from './routes/upload.js';
import { uploadsRouter } from './routes/uploads.js';
import { startJobs } from './jobs/index.js';
import { migrate } from './db/migrate.js';

import { sql } from './db/pool.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Railway/Render/Vercel proxies
app.use(express.json({ limit: '50mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// CORS — the web app lives on a different origin in dev (Vite :5173),
// production (restor.in), and Vercel preview deploys.
// Native ships CapacitorHttp, which bypasses CORS.
const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
   'https://restor.in',
  'https://www.restor.in',
  'https://test.restor.in',
];

const envOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

function isOriginAllowed(origin) {
  if (!origin) return true; // native apps (Capacitor), curl, server-to-server
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Support wildcard patterns like *.vercel.app or *.restor.in
  for (const pattern of allowedOrigins) {
    if (pattern.startsWith('*.') && origin.endsWith(pattern.slice(1))) {
      return true;
    }
    if (pattern.includes('*')) {
      const reg = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      if (reg.test(origin)) return true;
    }
  }
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.status(isOriginAllowed(origin) ? 204 : 403).end();
  }
  next();
});

// basic hardening headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Friendly root endpoint for deployment verification
app.get('/', (_req, res) => {
  res.json({
    service: 'shriji-backend',
    status: 'online',
    version: '0.1.0',
    health: '/health',
  });
});

app.use('/health', healthRouter);
app.use('/webhooks', webhooksRouter);
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 60 }), authRouter);
app.use('/api/dealers', rateLimit({ windowMs: 60_000, max: 60 }), dealersRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/content', contentRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/uploads', uploadsRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use(errorHandler);

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

if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    log.error('[server] failed to start:', err.message);
    process.exit(1);
  });
}

export default app;
