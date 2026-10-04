import crypto from 'node:crypto';
import { sql } from '../db/pool.js';
import { sha256 } from '../utils/hash.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';

const INVITE_TTL_DAYS = 7;

export async function createInvite(dealer) {
  // one live invite at a time per dealer — keeps the dashboard simple
  await sql`update staff_invites set revoked = true
            where dealer_id = ${dealer.id} and revoked = false and used_by is null`;
  const code = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await sql`insert into staff_invites (dealer_id, code_hash, expires_at)
            values (${dealer.id}, ${sha256(code)}, ${expiresAt})`;
  await audit(dealer.owner_user_id, 'staff.invite_created', 'dealer', dealer.id);
  return { code, expiresAt };
}

export async function consumeInvite(code, userId) {
  const rows = await sql`
    select si.id, si.dealer_id, si.expires_at, si.revoked, si.used_by
    from staff_invites si where si.code_hash = ${sha256(code)} limit 1`;
  const invite = rows[0];
  if (!invite) return null;
  if (invite.revoked || invite.used_by || new Date(invite.expires_at) < new Date()) return null;
  await sql`update staff_invites set used_by = ${userId}, used_at = now() where id = ${invite.id}`;
  return invite;
}

export async function approveStaff(dealer, staffUserId) {
  const rows = await sql`
    select id, status, dealer_id from users where id = ${staffUserId} and role = 'dealer_staff'`;
  const staff = rows[0];
  if (!staff || staff.dealer_id !== dealer.id) {
    throw Object.assign(new Error('Staff user not found for this dealer'), { statusCode: 404 });
  }
  await sql`update users set status = 'active' where id = ${staffUserId}`;
  await audit(dealer.owner_user_id, 'staff.approved', 'user', staffUserId);
}

export async function revokeStaff(dealer, staffUserId) {
  const rows = await sql`
    select id from users where id = ${staffUserId} and role = 'dealer_staff' and dealer_id = ${dealer.id}`;
  if (!rows[0]) {
    throw Object.assign(new Error('Staff user not found for this dealer'), { statusCode: 404 });
  }
  await sql`update users set status = 'revoked' where id = ${staffUserId}`;
  await sql`update refresh_tokens set revoked = true where user_id = ${staffUserId}`;
  await audit(dealer.owner_user_id, 'staff.revoked', 'user', staffUserId);
  log.info(`[staff] revoked user ${staffUserId} for dealer ${dealer.id}`);
}

// Human-readable, unambiguous code — same alphabet as utils/hash.js generateCode,
// duplicated here only to keep the service dependency-light in tests.
function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
