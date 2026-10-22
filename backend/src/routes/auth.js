import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { sql } from '../db/pool.js';
import { hashPassword, verifyPassword, generateOtp, sha256, formatLoginCode } from '../utils/hash.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../services/tokens.js';
import { jwtAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { httpError } from '../middleware/errorHandler.js';
import { sendEmailOtp, notify } from '../services/notifications.js';
import { audit } from '../utils/audit.js';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';
import * as crm from '../services/crmClient.js';
import { resolvePricebookId } from '../services/commerceClient.js';
import { normalizeEmail, isValidName, cleanName } from '../utils/validators.js';
import { applyCrmAccountState } from '../services/dealerApp.js';

export const authRouter = Router();
const strictLimit = rateLimit({ windowMs: 60_000, max: 10 });
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const googleClient = new OAuth2Client(env.googleClientId || undefined);
const lastCrmSyncByDealerId = new Map();

export function emailOnlyIdentifier(value) {
  return normalizeEmail(value);
}

export async function resolveUserWithDealer(user) {
  if (!user) return null;
  const email = normalizeEmail(user.email);
  const rows = await sql`
    select d.id, d.status from dealers d join users owner on owner.id = d.owner_user_id
    where d.id = ${user.dealer_id} ${email ? sql`or lower(owner.email) = ${email}` : sql``}
    order by case when d.status = 'approved' then 1 when d.status = 'pending' then 2 else 3 end asc
    limit 1`;
  const dealer = rows[0];
  if (dealer && user.role !== 'dealer_staff' && !['inactive', 'revoked'].includes(user.status)) {
    const role = ['pending', 'approved'].includes(dealer.status) ? 'dealer' : user.role;
    const status = dealer.status === 'approved' ? 'active' : user.status;
    if (role !== user.role || status !== user.status || dealer.id !== user.dealer_id) {
      await sql`update users set role = ${role}, status = ${status}, dealer_id = ${dealer.id} where id = ${user.id}`;
      Object.assign(user, { role, status, dealer_id: dealer.id });
    }
  }
  return user;
}

export async function findUserByEmail(email) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return null;
  const rows = await sql`
    select u.* from users u left join dealers d on d.owner_user_id = u.id or d.id = u.dealer_id
    where lower(u.email) = ${cleanEmail}
    order by case when u.role = 'dealer' or d.status = 'approved' then 1 when d.status = 'pending' then 2 else 3 end asc, u.created_at desc
    limit 1`;
  return rows[0] || null;
}

function publicUser(user) {
  return { id: user.id, email: user.email, full_name: user.full_name, role: user.role, status: user.status, dealer_id: user.dealer_id, email_verified: user.email_verified, can_see_dealer_price: user.can_see_dealer_price !== false };
}

async function issueSession(rawUser) {
  const user = await resolveUserWithDealer(rawUser);
  return { accessToken: signAccessToken(user), refreshToken: await issueRefreshToken(user.id), expiresIn: 30 * 24 * 60 * 60, user: publicUser(user) };
}

authRouter.post('/signup', strictLimit, async (req, res, next) => {
  try {
    const { email, password, full_name, first_name, last_name } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) throw httpError(400, 'A valid email address is required');
    if (!password || String(password).length < 8) throw httpError(400, 'A password of at least 8 characters is required');
    if (first_name && !isValidName(first_name)) throw httpError(400, 'First name should contain letters only (min 2 characters)');
    if (last_name && !isValidName(last_name)) throw httpError(400, 'Last name should contain letters only (min 2 characters)');
    if (await findUserByEmail(cleanEmail)) throw httpError(409, 'An account with this email already exists. Please log in.');
    const name = full_name ? cleanName(full_name) : [cleanName(first_name), cleanName(last_name)].filter(Boolean).join(' ') || null;
    const [user] = await sql`
      insert into users (email, password_hash, full_name, role, status, email_verified)
      values (${cleanEmail}, ${await hashPassword(String(password))}, ${name}, 'customer', 'active', false) returning *`;
    await audit(user.id, 'auth.signup', 'user', user.id);
    res.status(201).json(await issueSession(user));
  } catch (error) { next(error); }
});

authRouter.post('/login', strictLimit, async (req, res, next) => {
  try {
    const email = emailOnlyIdentifier(req.body?.email || req.body?.identifier);
    const password = req.body?.password;
    if (!email || !password) throw httpError(400, 'Email and password are required');
    const user = await findUserByEmail(email);
    if (!user || !await verifyPassword(String(password), user.password_hash || '')) throw httpError(401, 'Invalid email or password');
    await audit(user.id, 'auth.login', 'user', user.id);
    res.json(await issueSession(user));
  } catch (error) { next(error); }
});

authRouter.post('/google', strictLimit, async (req, res, next) => {
  try {
    const token = req.body?.credential || req.body?.idToken;
    if (!token) throw httpError(400, 'Google credential token is required');
    let payload;
    try { payload = (await googleClient.verifyIdToken({ idToken: token, audience: env.googleClientId || undefined })).getPayload(); }
    catch (error) { log.warn('[auth:google] verify failed:', error.message); throw httpError(401, 'Invalid Google token'); }
    const email = normalizeEmail(payload?.email);
    if (!email) throw httpError(400, 'Google account has no email');
    let user = await findUserByEmail(email);
    if (!user) {
      [user] = await sql`insert into users (email, full_name, role, status, email_verified) values (${email}, ${payload.name || payload.given_name || null}, 'customer', 'active', true) returning *`;
      await audit(user.id, 'auth.google_signup', 'user', user.id);
    } else await audit(user.id, 'auth.google_login', 'user', user.id);
    res.json(await issueSession(user));
  } catch (error) { next(error); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const rotated = await rotateRefreshToken(req.body?.refreshToken);
    if (!rotated) throw httpError(401, 'Invalid or expired session');
    res.json({ accessToken: signAccessToken(rotated.user), refreshToken: rotated.refreshToken, expiresIn: 30 * 24 * 60 * 60, user: publicUser(rotated.user) });
  } catch (error) { next(error); }
});

authRouter.post('/logout', async (req, res, next) => {
  try { if (req.body?.refreshToken) await revokeRefreshToken(req.body.refreshToken); res.status(204).end(); } catch (error) { next(error); }
});

authRouter.post('/staff/lookup-code', strictLimit, async (req, res, next) => {
  try {
    const raw = String(req.body?.code || req.body?.dealer_code || req.body?.invite_code || '').trim();
    if (!raw) throw httpError(400, 'code is required');
    const formatted = formatLoginCode(raw);
    const dealers = await sql`select id, business_name, dealer_code from dealers where (lower(dealer_code) = lower(${raw}) or lower(dealer_code) = lower(${formatted})) and status = 'approved' limit 1`;
    if (dealers[0]) return res.json({ ok: true, type: 'dealer_code', business_name: dealers[0].business_name, dealer_code: dealers[0].dealer_code });
    const rawHash = sha256(raw.toUpperCase()), formattedHash = sha256(formatted.toUpperCase());
    const invites = await sql`select si.dealer_id, d.business_name, d.dealer_code from staff_invites si join dealers d on d.id = si.dealer_id where (si.code_hash = ${rawHash} or si.code_hash = ${formattedHash}) and si.revoked = false and si.used_by is null and si.expires_at > now() limit 1`;
    if (invites[0]) return res.json({ ok: true, type: 'invite_code', business_name: invites[0].business_name, dealer_code: invites[0].dealer_code });
    throw httpError(404, 'Invalid or unrecognized Dealer / Business Code');
  } catch (error) { next(error); }
});

authRouter.post('/staff/signup', strictLimit, async (req, res, next) => {
  try {
    const { email, password, invite_code, dealer_code, code, full_name, first_name, last_name } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    const inputCode = String(dealer_code || code || invite_code || '').trim();
    if (!cleanEmail || !password || String(password).length < 8 || !inputCode) throw httpError(400, 'Email, password (8+ chars) and Dealer Code are required');
    if (first_name && !isValidName(first_name)) throw httpError(400, 'First name should contain letters only (min 2 characters)');
    if (last_name && !isValidName(last_name)) throw httpError(400, 'Last name should contain letters only (min 2 characters)');
    const name = full_name || [first_name, last_name].filter(Boolean).join(' ') || null;
    const duplicate = await sql`select id, role, status from users where lower(email) = ${cleanEmail}`;
    const existing = duplicate[0];
    if (existing && !((existing.role === 'dealer_staff' && existing.status === 'pending') || existing.role === 'customer')) throw httpError(409, 'Email already registered');
    const formatted = formatLoginCode(inputCode);
    const dealers = await sql`select id, staff_limit from dealers where (lower(dealer_code) = lower(${inputCode}) or lower(dealer_code) = lower(${formatted})) and status = 'approved' limit 1`;
    let dealerId, inviteId;
    if (dealers[0]) {
      dealerId = dealers[0].id;
      const count = await sql`select count(*)::int as n from users where dealer_id = ${dealerId} and role = 'dealer_staff' and status in ('active', 'pending') and (${existing?.id ? sql`id != ${existing.id}` : sql`true`})`;
      if (count[0].n >= dealers[0].staff_limit) throw httpError(409, 'This dealer has reached their staff limit');
    } else {
      const rawHash = sha256(inputCode.toUpperCase()), formattedHash = sha256(formatted.toUpperCase());
      const invites = await sql`select id, dealer_id, expires_at, revoked, used_by from staff_invites where (code_hash = ${rawHash} or code_hash = ${formattedHash}) limit 1`;
      const invite = invites[0];
      if (!invite || invite.revoked || (invite.used_by && invite.used_by !== existing?.id) || new Date(invite.expires_at) < new Date()) throw httpError(401, 'Invalid or expired Dealer / Invite Code');
      dealerId = invite.dealer_id; inviteId = invite.id;
    }
    let user;
    if (existing) [user] = await sql`update users set password_hash = ${await hashPassword(String(password))}, full_name = ${name ? String(name).trim() : null}, role = 'dealer_staff', status = 'pending', dealer_id = ${dealerId}, email = ${cleanEmail} where id = ${existing.id} returning *`;
    else [user] = await sql`insert into users (email, password_hash, full_name, role, status, dealer_id) values (${cleanEmail}, ${await hashPassword(String(password))}, ${name ? String(name).trim() : null}, 'dealer_staff', 'pending', ${dealerId}) returning *`;
    if (inviteId) await sql`update staff_invites set used_by = ${user.id}, used_at = now() where id = ${inviteId}`;
    await audit(user.id, 'staff.signed_up', 'dealer', dealerId);
    const owners = await sql`select owner_user_id from dealers where id = ${dealerId}`;
    if (owners[0]) await notify(owners[0].owner_user_id, 'email', 'staff_pending_approval', { staffEmail: user.email });
    res.status(201).json({ ok: true, status: 'pending', ...(await issueSession(user)) });
  } catch (error) { next(error); }
});

authRouter.get('/me', jwtAuth, async (req, res, next) => {
  try {
    const user = await resolveUserWithDealer(req.user);
    const userDealerId = user?.dealer_id || null;
    let dealer = (await sql`select * from dealers where id = ${userDealerId} or owner_user_id = ${user.id} order by case when status = 'approved' then 1 when status = 'pending' then 2 else 3 end asc limit 1`)[0] || null;
    if (dealer?.zoho_account_id && crm.isCrmConfigured()) {
      const last = lastCrmSyncByDealerId.get(dealer.id) || 0;
      if (Date.now() - last > 30_000) {
        lastCrmSyncByDealerId.set(dealer.id, Date.now());
        try { const account = await crm.getDealerAccount(dealer.zoho_account_id); if (account) await applyCrmAccountState(dealer, account); } catch (error) { log.warn('[auth/me] CRM sync skipped:', error.message); }
      }
    }
    if (dealer) dealer = { ...dealer, pricebook_id: await resolvePricebookId(dealer.price_tier), hide_staff_dealer_price: Boolean(dealer.hide_staff_dealer_price) };
    res.json({ user: publicUser(user), dealer });
  } catch (error) { next(error); }
});

authRouter.post('/email/request-otp', jwtAuth, rateLimit({ windowMs: 10 * 60_000, max: 6 }), async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email || req.user.email);
    if (!email) throw httpError(400, 'A valid email address is required');
    const existing = await sql`select id from users where lower(email) = ${email} and id != ${req.user.id} limit 1`;
    if (existing.length) throw httpError(409, 'This email address is already registered to another account');
    const code = generateOtp();
    await sql`insert into otp_codes (user_id, identifier, code_hash, expires_at) values (${req.user.id}, ${email}, ${sha256(code)}, ${new Date(Date.now() + OTP_TTL_MINUTES * 60_000)})`;
    await sendEmailOtp({ email, code });
    res.json({ ok: true, email, expires_in_minutes: OTP_TTL_MINUTES, ...(process.env.ENABLE_DEV_OTP === 'true' ? { dev_code: code } : {}) });
  } catch (error) { next(error); }
});

authRouter.post('/email/verify-otp', jwtAuth, strictLimit, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email), code = String(req.body?.code || '').trim();
    if (!email || !code) throw httpError(400, 'Valid email and 6-digit verification code are required');
    const rows = await sql`select id, attempts, code_hash from otp_codes where (identifier = ${email} or user_id = ${req.user.id}) and expires_at > now() and attempts < ${OTP_MAX_ATTEMPTS} order by created_at desc limit 1`;
    const otp = rows[0];
    if (!otp || otp.code_hash !== sha256(code)) { if (otp) await sql`update otp_codes set attempts = attempts + 1 where id = ${otp.id}`; throw httpError(401, 'Invalid or expired verification code'); }
    await sql`delete from otp_codes where id = ${otp.id}`;
    await sql`update users set email = ${email}, email_verified = true where id = ${req.user.id}`;
    const [user] = await sql`select * from users where id = ${req.user.id}`;
    if (user?.zoho_contact_id && crm.isCrmConfigured()) try { await crm.crmFetch('/Contacts', { method: 'PUT', body: { data: [{ id: user.zoho_contact_id, Email: email }] } }); } catch (error) { log.warn('[auth:email] CRM sync skipped:', error.message); }
    await audit(req.user.id, 'auth.email_verified', 'user', req.user.id);
    res.json({ ok: true, email, email_verified: true, user: publicUser(user) });
  } catch (error) { next(error); }
});
