import { Router } from 'express';
import crypto from 'node:crypto';
import { signAdminToken } from '../services/tokens.js';
import { requireAdmin } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

export const adminRouter = Router();

// Strict rate limit for admin authentication attempts: 5 per 15 minutes per IP
const loginRateLimit = rateLimit({ windowMs: 15 * 60_000, max: 5, prefix: 'admin_login' });

/**
 * POST /api/admin/login
 * Validates the admin secret key server-side using constant-time comparison.
 * Issues a short-lived signed JWT session token (1 hour) with purpose: 'admin_session'.
 * Raw admin keys are NEVER logged, returned in responses, or persisted in browser storage.
 */
adminRouter.post('/login', loginRateLimit, async (req, res) => {
  const configuredAdminKey = process.env.ADMIN_API_KEY || '';

  if (!configuredAdminKey || configuredAdminKey.length < 16) {
    return res.status(503).json({
      ok: false,
      error: 'admin_auth_not_configured',
      message: 'Administrative authentication is not configured on this server.',
    });
  }

  const candidateKey = String(req.body?.adminKey || '');

  let isMatch = false;
  if (candidateKey.length === configuredAdminKey.length) {
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(candidateKey, 'utf8'),
        Buffer.from(configuredAdminKey, 'utf8')
      );
    } catch {
      isMatch = false;
    }
  }

  if (!isMatch) {
    return res.status(401).json({
      ok: false,
      error: 'invalid_admin_credentials',
      message: 'Invalid administrative credentials.',
    });
  }

  const token = signAdminToken({ expiresIn: 3600 });
  return res.json({
    ok: true,
    token,
    expiresIn: 3600,
    message: 'Admin session authenticated successfully.',
  });
});

/**
 * GET /api/admin/session
 * Verifies that the current administrative Bearer token is valid and active.
 */
adminRouter.get('/session', requireAdmin, (req, res) => {
  return res.json({
    ok: true,
    admin: true,
    authenticated: true,
  });
});
