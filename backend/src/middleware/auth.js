import crypto from 'node:crypto';
import { sql } from '../db/pool.js';
import { verifyAccessToken } from '../services/tokens.js';

/**
 * JWT auth. Verifies the token, then re-reads the user so revoked/deactivated
 * accounts (or rotated-out roles) fail immediately, not at next token expiry.
 */
export async function jwtAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'auth_required' });

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      return res.status(401).json({ error: 'token_invalid_or_expired' });
    }

    try {
      const rows = await sql`
        select u.id, u.email, u.phone, u.phone_verified, u.role, u.status, u.dealer_id, u.email_verified,
               u.can_see_dealer_price, d.hide_staff_dealer_price, u.created_at, u.full_name
        from users u
        left join dealers d on d.id = u.dealer_id
        where u.id = ${claims.sub}`;
      const user = rows[0];
      // pending and rejected users keep access so the app can poll /me, converge with CRM, and display status;
      // revoked/inactive accounts are cut off immediately.
      if (!user || user.status === 'revoked' || user.status === 'inactive') {
        return res.status(401).json({ error: 'account_inactive' });
      }
      req.user = user;
      return next();
    } catch (dbErr) {
      // If DB is temporarily unreachable or times out, fallback gracefully to verified claims
      if (claims && claims.sub && claims.status !== 'revoked' && claims.status !== 'inactive') {
        req.user = {
          id: claims.sub,
          role: claims.role,
          status: claims.status || 'active',
          dealer_id: claims.dealer_id || null,
          can_see_dealer_price: claims.can_see_dealer_price !== false,
        };
        return next();
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
}

/** Gate a route to specific roles, e.g. requireRole('dealer'). */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  next();
};

/** Dealer must be active AND their dealer record approved (for dealer-only powers). */
export async function requireApprovedDealer(req, res, next) {
  try {
    if (!req.user || req.user.role !== 'dealer') {
      return res.status(403).json({ error: 'forbidden' });
    }
    try {
      const rows = await sql`select * from dealers where id = ${req.user.dealer_id}`;
      const dealer = rows[0];
      if (!dealer || dealer.status !== 'approved') {
        return res.status(403).json({ error: 'dealer_not_approved' });
      }
      req.dealer = dealer;
      return next();
    } catch (dbErr) {
      if (req.user.dealer_id && req.user.status === 'approved') {
        req.dealer = { id: req.user.dealer_id, status: 'approved' };
        return next();
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces server-side administrative identity.
 * Validates either a matching ADMIN_API_KEY (via X-Admin-Key or Bearer token)
 * or a verified JWT for an active user with role === 'admin'.
 * Fails closed if neither is provided.
 */
export async function requireAdmin(req, res, next) {
  const adminKeyHeader = req.headers['x-admin-key'];
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const configuredAdminKey = process.env.ADMIN_API_KEY || '';

  // 1. Verify ADMIN_API_KEY using timing-safe comparison
  if (configuredAdminKey && configuredAdminKey.length >= 16) {
    const candidateKey = adminKeyHeader || bearerToken;
    if (candidateKey && candidateKey.length === configuredAdminKey.length) {
      if (crypto.timingSafeEqual(Buffer.from(candidateKey), Buffer.from(configuredAdminKey))) {
        req.isAdmin = true;
        return next();
      }
    }
  }

  // 2. Verify JWT token for role === 'admin'
  if (bearerToken) {
    try {
      const claims = verifyAccessToken(bearerToken);
      if (claims && claims.role === 'admin') {
        if (claims.purpose === 'admin_session') {
          req.isAdmin = true;
          req.adminPurpose = 'admin_session';
          return next();
        }
        if (claims.sub && claims.sub !== 'admin') {
          try {
            const rows = await sql`
              select u.id, u.email, u.role, u.status
              from users u
              where u.id = ${claims.sub}`;
            const user = rows[0];
            if (user && user.role === 'admin' && user.status === 'active') {
              req.user = user;
              req.isAdmin = true;
              return next();
            }
          } catch {
            // DB lookup failed or unavailable
          }
        }
      }
    } catch {
      // Invalid/expired token
    }
  }

  return res.status(401).json({
    error: 'admin_auth_required',
    message: 'Administrative authentication is required for this operation.',
  });
}

/**
 * Optional JWT auth: populates req.user if a valid Bearer token is present,
 * but allows unauthenticated guest requests to proceed without error.
 */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const claims = verifyAccessToken(token);
    const rows = await sql`
      select u.id, u.email, u.phone, u.phone_verified, u.role, u.status, u.dealer_id, u.email_verified,
             u.can_see_dealer_price, u.full_name
      from users u
      where u.id = ${claims.sub}`;
    const user = rows[0];
    if (user && user.status !== 'rejected' && user.status !== 'revoked' && user.status !== 'inactive') {
      req.user = user;
    }
  } catch {}
  next();
}
