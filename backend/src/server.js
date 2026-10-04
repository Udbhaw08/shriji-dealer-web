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
import { startJobs } from './jobs/index.js';
import { migrate } from './db/migrate.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Railway/Render/Vercel proxies
app.use(express.json({ limit: '256kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// CORS — the web app lives on a different origin in dev (Vite :5173) and
// production (shrijidomestic.com). Native ships CapacitorHttp, which bypasses CORS.
const allowedOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// basic hardening headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use('/health', healthRouter);
app.use('/webhooks', webhooksRouter);
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 60 }), authRouter);
app.use('/api/dealers', rateLimit({ windowMs: 60_000, max: 60 }), dealersRouter);
app.use('/api/prices', pricesRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use(errorHandler);

async function start() {
  await migrate();
  startJobs();
  app.listen(env.port, () => log.info(`[server] listening on :${env.port}`));
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    log.error('[server] failed to start:', err.message);
    process.exit(1);
  });
}

export default app;
