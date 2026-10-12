import { sql } from '../db/pool.js';
import { verifyAccessToken } from '../services/tokens.js';

/**
 * JWT auth. Verifies the token, then re-reads the user so revoked/deactivated
 * accounts (or rotated-out roles) fail immediately, not at next token expiry.
 */
export async function jwtAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: 'token_invalid_or_expired' });
  }

  const rows = await sql`
    select u.id, u.email, u.phone, u.role, u.status, u.dealer_id, u.email_verified,
           u.can_see_dealer_price, d.hide_staff_dealer_price, u.created_at
    from users u
    left join dealers d on d.id = u.dealer_id
    where u.id = ${claims.sub}`;
  const user = rows[0];
  // pending users keep access so the app can poll /me while awaiting approval;
  // rejected/revoked accounts are cut off immediately.
  if (!user || user.status === 'rejected' || user.status === 'revoked' || user.status === 'inactive') {
    return res.status(401).json({ error: 'account_inactive' });
  }
  req.user = user;
  next();
}

/** Gate a route to specific roles, e.g. requireRole('dealer'). */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  next();
};

/** Dealer must be active AND their dealer record approved (for dealer-only powers). */
export async function requireApprovedDealer(req, res, next) {
  if (!req.user || req.user.role !== 'dealer') {
    return res.status(403).json({ error: 'forbidden' });
  }
  const rows = await sql`select * from dealers where id = ${req.user.dealer_id}`;
  const dealer = rows[0];
  if (!dealer || dealer.status !== 'approved') {
    return res.status(403).json({ error: 'dealer_not_approved' });
  }
  req.dealer = dealer;
  next();
}
