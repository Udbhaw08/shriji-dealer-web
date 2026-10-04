import { Router } from 'express';
import { sql } from '../db/pool.js';
import { hashPassword, verifyPassword, generateOtp, sha256 } from '../utils/hash.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../services/tokens.js';
import { jwtAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { httpError } from '../middleware/errorHandler.js';
import { notify } from '../services/notifications.js';
import { audit } from '../utils/audit.js';

export const authRouter = Router();

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const strictLimit = rateLimit({ windowMs: 60_000, max: 10 });

async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, expiresIn: 900 };
}

function publicUser(u) {
  return { id: u.id, email: u.email, phone: u.phone, role: u.role, status: u.status, dealer_id: u.dealer_id, email_verified: u.email_verified };
}

/* POST /api/auth/signup — customers sign up and can browse MRP immediately. */
authRouter.post('/signup', strictLimit, async (req, res, next) => {
  try {
    const { email, password, phone, full_name } = req.body || {};
    if (!email || !password || String(password).length < 8) {
      throw httpError(400, 'email and a password of at least 8 characters are required');
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await sql`select id from users where email = ${normalizedEmail}`;
    if (existing.length) throw httpError(409, 'email already registered');

    const [user] = await sql`
      insert into users (email, phone, password_hash, full_name, role, status)
      values (${normalizedEmail}, ${phone || null}, ${await hashPassword(String(password))},
              ${full_name ? String(full_name).trim() : null}, 'customer', 'active')
      returning *`;
    await audit(user.id, 'auth.signup', 'user', user.id);
    res.status(201).json({ user: publicUser(user), ...(await issueSession(user)) });
  } catch (err) { next(err); }
});

/* POST /api/auth/login */
authRouter.post('/login', strictLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw httpError(400, 'email and password are required');
    const rows = await sql`select * from users where email = ${String(email).trim().toLowerCase()}`;
    const user = rows[0];
    // constant-shape failure: always run a hash compare
    const ok = user ? await verifyPassword(String(password), user.password_hash || '') : false;
    if (!ok) throw httpError(401, 'invalid credentials');
    await audit(user.id, 'auth.login', 'user', user.id);
    res.json({ user: publicUser(user), ...(await issueSession(user)) });
  } catch (err) { next(err); }
});

/* POST /api/auth/refresh — rotate the refresh token. */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw httpError(400, 'refreshToken required');
    const rotated = await rotateRefreshToken(String(refreshToken));
    if (!rotated) throw httpError(401, 'refresh token invalid');
    res.json({ user: publicUser(rotated.user), accessToken: signAccessToken(rotated.user), refreshToken: rotated.refreshToken, expiresIn: 900 });
  } catch (err) { next(err); }
});

/* POST /api/auth/logout */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) await revokeRefreshToken(String(refreshToken));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* POST /api/auth/otp/request */
authRouter.post('/otp/request', rateLimit({ windowMs: 10 * 60_000, max: 5 }), async (req, res, next) => {
  try {
    const { email, phone } = req.body || {};
    const lookup = String(email || '').trim().toLowerCase();
    const lookupPhone = String(phone || '').trim();
    const rows = await sql`
      select id from users
      where (${lookup} <> '' and email = ${lookup})
         or (${lookupPhone} <> '' and phone = ${lookupPhone})
      limit 1`;
    if (rows[0]) {
      const code = generateOtp();
      await sql`insert into otp_codes (user_id, code_hash, expires_at)
                values (${rows[0].id}, ${sha256(code)},
                        ${new Date(Date.now() + OTP_TTL_MINUTES * 60_000)})`;
      await notify(rows[0].id, 'email', 'otp_code', { code });
    }
    // same response whether or not the account exists — no enumeration
    res.json({ ok: true, expires_in_minutes: OTP_TTL_MINUTES });
  } catch (err) { next(err); }
});

/* POST /api/auth/otp/verify */
authRouter.post('/otp/verify', strictLimit, async (req, res, next) => {
  try {
    const { email, phone, code } = req.body || {};
    const lookup = String(email || '').trim().toLowerCase();
    const lookupPhone = String(phone || '').trim();
    const rows = await sql`
      select * from users
      where (${lookup} <> '' and email = ${lookup})
         or (${lookupPhone} <> '' and phone = ${lookupPhone})
      limit 1`;
    const user = rows[0];
    if (!user || !code) throw httpError(401, 'invalid code');

    const otpRows = await sql`
      select id, attempts, expires_at from otp_codes
      where user_id = ${user.id} and expires_at > now() and attempts < ${OTP_MAX_ATTEMPTS}
      order by created_at desc limit 1`;
    const otp = otpRows[0];
    if (!otp || sha256(String(code)) !== (await sql`select code_hash from otp_codes where id = ${otp.id}`)[0]?.code_hash) {
      if (otp) await sql`update otp_codes set attempts = attempts + 1 where id = ${otp.id}`;
      throw httpError(401, 'invalid code');
    }
    await sql`delete from otp_codes where id = ${otp.id}`;
    await sql`update users set email_verified = true where id = ${user.id}`;
    await audit(user.id, 'auth.otp_verified', 'user', user.id);
    res.json({ user: publicUser({ ...user, email_verified: true }), ...(await issueSession(user)) });
  } catch (err) { next(err); }
});

/* POST /api/auth/staff/signup — staff redeem an invite code (no session yet). */
authRouter.post('/staff/signup', strictLimit, async (req, res, next) => {
  try {
    const { email, password, invite_code, full_name, phone } = req.body || {};
    if (!email || !password || String(password).length < 8 || !invite_code) {
      throw httpError(400, 'email, password (8+ chars) and invite_code are required');
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const dupe = await sql`select id from users where email = ${normalizedEmail}`;
    if (dupe.length) throw httpError(409, 'email already registered');

    const inviteRows = await sql`
      select si.id, si.dealer_id, si.expires_at, si.revoked, si.used_by
      from staff_invites si where si.code_hash = ${sha256(String(invite_code))} limit 1`;
    const invite = inviteRows[0];
    if (!invite || invite.revoked || invite.used_by || new Date(invite.expires_at) < new Date()) {
      throw httpError(401, 'invalid or expired invite code');
    }

    const [user] = await sql`
      insert into users (email, phone, password_hash, full_name, role, status, dealer_id)
      values (${normalizedEmail}, ${phone ? String(phone).trim() : null},
              ${await hashPassword(String(password))},
              ${full_name ? String(full_name).trim() : null},
              'dealer_staff', 'pending', ${invite.dealer_id})
      returning *`;
    await sql`update staff_invites set used_by = ${user.id}, used_at = now() where id = ${invite.id}`;
    await audit(user.id, 'staff.signed_up', 'dealer', invite.dealer_id);
    // notify the dealer's owner (dealers.id is not a users.id)
    const ownerRows = await sql`select owner_user_id from dealers where id = ${invite.dealer_id}`;
    if (ownerRows[0]) {
      await notify(ownerRows[0].owner_user_id, 'email', 'staff_pending_approval', { staffEmail: user.email });
    }
    // no session until the dealer approves — the staff user stays pending
    res.status(201).json({ ok: true, status: 'pending' });
  } catch (err) { next(err); }
});

/* GET /api/auth/me — the pending-approval screen polls this. */
authRouter.get('/me', jwtAuth, async (req, res, next) => {
  try {
    let dealer = null;
    if (req.user.dealer_id) {
      const rows = await sql`select id, business_name, status, reject_reason, dealer_code, price_tier
                             from dealers where id = ${req.user.dealer_id}`;
      dealer = rows[0] || null;
    }
    res.json({ user: publicUser(req.user), dealer });
  } catch (err) { next(err); }
});
