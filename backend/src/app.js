import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './middleware/rateLimit.js';
import { authRouter } from './routes/auth.js';
import { dealersRouter } from './routes/dealers.js';
import { pricesRouter } from './routes/prices.js';
import { webhooksRouter } from './routes/webhooks.js';
import { healthRouter } from './routes/health.js';
import { contentRouter } from './routes/content.js';
import { adminRouter } from './routes/admin.js';
import { uploadRouter } from './routes/upload.js';
import { uploadsRouter } from './routes/uploads.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true); // behind Cloudflare/Render/Vercel proxies

  // Serverless / Pre-parsed body guard:
  // If req.body is already populated (e.g. by Vercel serverless runtime), skip express.json()
  // to avoid hanging on an already-consumed stream.
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        try { req.body = JSON.parse(req.body); } catch {}
      }
      return next();
    }
    express.json({ limit: '1mb', verify: (r, _res, buf) => { r.rawBody = buf; } })(req, res, next);
  });

  // Fallback: Parse body from rawBody if client sent text/plain or omitted Content-Type
  app.use((req, _res, next) => {
    if ((!req.body || Object.keys(req.body).length === 0) && req.rawBody && req.rawBody.length > 0) {
      try {
        req.body = JSON.parse(req.rawBody.toString('utf8'));
      } catch {}
    }
    next();
  });

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
    'https://astro.in',
    'https://www.astro.in',
    'https://test.astro.in',
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret, X-Requested-With, Accept, X-Admin-Key');
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
  app.use(['/webhooks', '/api/webhooks'], webhooksRouter);
  app.use(['/api/auth', '/auth'], rateLimit({ windowMs: 60_000, max: () => env.authGlobalRateLimitMax || 1200, prefix: 'auth_global' }), authRouter);
  app.use(['/api/dealers', '/dealers'], rateLimit({ windowMs: 60_000, max: () => env.dealersGlobalRateLimitMax || 1200, prefix: 'dealers_global' }), dealersRouter);
  app.use('/api/prices', pricesRouter);
  app.use('/api/content', contentRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/uploads', uploadsRouter);

  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
