import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sql } from '../db/pool.js';
import { sha256, randomToken } from '../utils/hash.js';

const ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const REFRESH_TTL_DAYS = 30; // 30 days

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      dealer_id: user.dealer_id,
      status: user.status,
    },
    env.jwtSecret,
    { expiresIn: ACCESS_TTL_SECONDS },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret); // throws on invalid/expired
}

export async function issueRefreshToken(userId) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await sql`insert into refresh_tokens (user_id, token_hash, expires_at)
            values (${userId}, ${sha256(token)}, ${expiresAt})`;
  return token;
}

/** Rotate: consume one refresh token, revoke it, return the user + a new one. */
export async function rotateRefreshToken(rawToken) {
  const rows = await sql`
    select rt.id, rt.user_id, rt.expires_at, rt.revoked,
           u.id as uid, u.email, u.role, u.status, u.dealer_id
    from refresh_tokens rt join users u on u.id = rt.user_id
    where rt.token_hash = ${sha256(rawToken)} limit 1`;
  const row = rows[0];
  if (!row) return null;
  if (row.revoked || new Date(row.expires_at) < new Date()) {
    return null;
  }
  if (row.status === 'rejected' || row.status === 'revoked' || row.status === 'inactive') return null;
  await sql`update refresh_tokens set revoked = true where id = ${row.id}`;
  const fresh = await issueRefreshToken(row.user_id);
  return {
    user: { id: row.uid, email: row.email, role: row.role, status: row.status, dealer_id: row.dealer_id },
    refreshToken: fresh,
  };
}

export async function revokeRefreshToken(rawToken) {
  await sql`update refresh_tokens set revoked = true where token_hash = ${sha256(rawToken)}`;
}

export async function revokeAllForUser(userId) {
  await sql`update refresh_tokens set revoked = true where user_id = ${userId}`;
}
