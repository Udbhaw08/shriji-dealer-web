import crypto from 'node:crypto';
import { verifyAccessToken } from '../../backend/src/services/tokens.js';

/**
 * Validates server-side administrative identity.
 * Checks for:
 * 1. Matching ADMIN_API_KEY via X-Admin-Key or Bearer token (timing-safe comparison).
 * 2. Or a verified JWT with role === 'admin'.
 *
 * If no admin auth is present or if ADMIN_API_KEY is unconfigured and no admin token exists,
 * returns false (fails closed).
 */
export async function verifyAdminAuth(req) {
  const adminKeyHeader = req.headers?.['x-admin-key'] || req.headers?.['X-Admin-Key'];
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const configuredAdminKey = process.env.ADMIN_API_KEY || '';

  // 1. Check ADMIN_API_KEY (minimum 16 characters required for safety)
  if (configuredAdminKey && configuredAdminKey.length >= 16) {
    const candidateKey = adminKeyHeader || bearerToken;
    if (candidateKey && candidateKey.length === configuredAdminKey.length) {
      if (crypto.timingSafeEqual(Buffer.from(candidateKey), Buffer.from(configuredAdminKey))) {
        return { ok: true, admin: true, method: 'api_key' };
      }
    }
  }

  // 2. Check JWT token for role === 'admin'
  if (bearerToken) {
    try {
      const decoded = verifyAccessToken(bearerToken);
      if (decoded && decoded.role === 'admin') {
        return { ok: true, admin: true, user: decoded, method: 'jwt' };
      }
    } catch {
      // Invalid or expired token
    }
  }

  return { ok: false, error: 'admin_auth_required' };
}
