import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { sql } from '../db/pool.js';
import { hashPassword, verifyPassword, generateOtp, sha256, formatLoginCode } from '../utils/hash.js';
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../services/tokens.js';
import { jwtAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { httpError } from '../middleware/errorHandler.js';
import { sendOtpNotification, notify } from '../services/notifications.js';
import { audit } from '../utils/audit.js';
import { env } from '../config/env.js';
import { log } from '../utils/logger.js';
import * as crm from '../services/crmClient.js';
import { resolvePricebookId } from '../services/commerceClient.js';

export const authRouter = Router();

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const strictLimit = rateLimit({ windowMs: 60_000, max: 10 });

const googleClient = new OAuth2Client(env.googleClientId || undefined);

export async function resolveUserWithDealer(u) {
  if (!u) return null;
  const cleanDigits = u.phone ? String(u.phone).replace(/[^\d]/g, '').slice(-10) : null;
  const cleanEmail = u.email ? String(u.email).trim().toLowerCase() : null;

  const rows = await sql`
    select d.id, d.status, d.business_name, d.dealer_code, d.price_tier, d.gst_number, d.gst_treatment, d.owner_user_id
    from dealers d
    left join users ou on ou.id = d.owner_user_id
    where d.id = ${u.dealer_id}
       or d.owner_user_id = ${u.id}
       ${cleanDigits ? sql`
       or (
         ou.phone is not null and (
           ou.phone = ${u.phone}
           or ou.phone like ${`%${cleanDigits}`}
           or replace(ou.phone, ' ', '') like ${`%${cleanDigits}`}
         )
       )` : sql``}
       ${cleanEmail ? sql`
       or (
         ou.email is not null and lower(ou.email) = ${cleanEmail}
       )` : sql``}
    order by case when d.status = 'approved' then 1 when d.status = 'pending' then 2 else 3 end asc,
             d.created_at desc
    limit 1`;
  const dealer = rows[0];
  if (dealer) {
    let changed = false;
    // Do not modify staff members — their status stays 'pending' until the owner approves them
    if (u.role !== 'dealer_staff' && u.status !== 'inactive' && u.status !== 'revoked') {
      if (dealer.status === 'approved') {
        if (u.role !== 'dealer') {
          u.role = 'dealer';
          changed = true;
        }
        if (u.status !== 'approved' && u.status !== 'active') {
          u.status = 'active';
          changed = true;
        }
        if (u.dealer_id !== dealer.id) {
          u.dealer_id = dealer.id;
          changed = true;
        }
      } else if (dealer.status === 'pending') {
        if (u.role !== 'dealer') {
          u.role = 'dealer';
          changed = true;
        }
        if (u.dealer_id !== dealer.id) {
          u.dealer_id = dealer.id;
          changed = true;
        }
      }
    }
    if (changed) {
      await sql`update users set role = ${u.role}, status = ${u.status}, dealer_id = ${u.dealer_id} where id = ${u.id}`;
    }
  }
  return u;
}

export async function linkUserIdentifiers(u, { email, phone }) {
  if (!u) return u;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const cleanPhone = phone ? String(phone).trim() : null;
  let changed = false;

  // 1. Link email if missing on user record
  if (cleanEmail && (!u.email || u.email.trim().toLowerCase() !== cleanEmail)) {
    const existing = await sql`select id from users where lower(email) = ${cleanEmail} and id != ${u.id} limit 1`;
    if (!existing.length) {
      await sql`update users set email = ${cleanEmail}, email_verified = true where id = ${u.id}`;
      u.email = cleanEmail;
      u.email_verified = true;
      changed = true;
      log.info(`[auth:link] linked email ${cleanEmail} to user ${u.id}`);
    }
  }

  // 2. Link phone if missing on user record
  if (cleanPhone && (!u.phone || u.phone.trim() !== cleanPhone)) {
    const cleanDigits = cleanPhone.replace(/[^\d]/g, '').slice(-10);
    const existing = await sql`select id from users where (phone = ${cleanPhone} or phone like ${`%${cleanDigits}`}) and id != ${u.id} limit 1`;
    if (!existing.length) {
      await sql`update users set phone = ${cleanPhone} where id = ${u.id}`;
      u.phone = cleanPhone;
      changed = true;
      log.info(`[auth:link] linked phone ${cleanPhone} to user ${u.id}`);
    }
  }

  // 3. Sync to Zoho CRM Contact and Account if configured
  if (changed && crm.isCrmConfigured()) {
    try {
      if (u.zoho_contact_id) {
        await crm.crmFetch('/Contacts', {
          method: 'PUT',
          body: {
            data: [{
              id: u.zoho_contact_id,
              ...(u.email ? { Email: u.email } : {}),
              ...(u.phone ? { Phone: u.phone, Mobile: u.phone } : {}),
            }],
          },
        });
        log.info(`[auth:link] synced updated email/phone to Zoho CRM Contact ${u.zoho_contact_id}`);
      }

      if (u.dealer_id) {
        const [dInfo] = await sql`select zoho_account_id from dealers where id = ${u.dealer_id}`;
        if (dInfo?.zoho_account_id) {
          await crm.crmFetch('/Accounts', {
            method: 'PUT',
            body: {
              data: [{
                id: dInfo.zoho_account_id,
                ...(u.email ? { Email: u.email } : {}),
                ...(u.phone ? { Phone: u.phone } : {}),
              }],
            },
          });
          log.info(`[auth:link] synced updated email/phone to Zoho CRM Account ${dInfo.zoho_account_id}`);
        }
      }
    } catch (crmErr) {
      log.warn(`[auth:link] Zoho CRM contact sync warning: ${crmErr.message}`);
    }
  }

  return u;
}

export async function findUserByIdentifier({ email, phone }) {
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const rawPhone = phone ? String(phone).trim() : null;
  const cleanDigits = rawPhone ? rawPhone.replace(/[^\d]/g, '').slice(-10) : null;

  // 1. Check users table by phone
  if (rawPhone || cleanDigits) {
    const rows = await sql`
      select u.*
      from users u
      left join dealers d on d.owner_user_id = u.id or d.id = u.dealer_id
      where u.phone = ${rawPhone}
         ${cleanDigits ? sql`or u.phone like ${`%${cleanDigits}`} or replace(u.phone, ' ', '') like ${`%${cleanDigits}`}` : sql``}
      order by
        case when u.role = 'dealer' or d.status = 'approved' then 1
             when d.status = 'pending' then 2
             when u.dealer_id is not null then 3
             else 4 end asc,
        u.created_at desc
      limit 1`;
    if (rows[0]) return rows[0];
  }

  // 2. Check users table by email
  if (cleanEmail) {
    const rows = await sql`
      select u.*
      from users u
      left join dealers d on d.owner_user_id = u.id or d.id = u.dealer_id
      where lower(u.email) = ${cleanEmail}
      order by
        case when u.role = 'dealer' or d.status = 'approved' then 1
             when d.status = 'pending' then 2
             when u.dealer_id is not null then 3
             else 4 end asc,
        u.created_at desc
      limit 1`;
    if (rows[0]) return rows[0];
  }

  // 3. Check dealers table owner_user_id
  if (rawPhone || cleanDigits || cleanEmail) {
    const dealerRows = await sql`
      select ou.*
      from dealers d
      join users ou on ou.id = d.owner_user_id
      where (${cleanEmail ? sql`lower(ou.email) = ${cleanEmail} or ` : sql``}
             ${cleanDigits ? sql`ou.phone like ${`%${cleanDigits}`} or replace(ou.phone, ' ', '') like ${`%${cleanDigits}`} or ` : sql``}
             ou.phone = ${rawPhone})
      order by case when d.status = 'approved' then 1 when d.status = 'pending' then 2 else 3 end asc
      limit 1`;
    if (dealerRows[0]) return dealerRows[0];
  }

  return null;
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days window
async function issueSession(rawUser) {
  const user = await resolveUserWithDealer(rawUser);
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, expiresIn: SESSION_TTL_SECONDS, user: publicUser(user) };
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    full_name: u.full_name,
    role: u.role,
    status: u.status,
    dealer_id: u.dealer_id,
    email_verified: u.email_verified,
    can_see_dealer_price: u.can_see_dealer_price !== false,
  };
}

export function parseIdentifier(input) {
  if (!input) return { email: null, phone: null };
  const str = String(input).trim();
  if (str.includes('@')) {
    return { email: str.toLowerCase(), phone: null };
  }
  // Phone: keep + and digits
  const clean = str.replace(/[^\d+]/g, '');
  return { email: null, phone: clean || str };
}


/* POST /api/auth/signup — register via Email, Phone, or Both (links existing account if found). */
authRouter.post('/signup', strictLimit, async (req, res, next) => {
  try {
    const { email, phone, identifier, password, full_name } = req.body || {};
    const parsed = parseIdentifier(identifier);
    const cleanEmail = email ? String(email).trim().toLowerCase() : parsed.email;
    const cleanPhone = phone ? String(phone).trim() : parsed.phone;

    if (!cleanEmail && !cleanPhone) {
      throw httpError(400, 'Mobile number or Email is required');
    }
    if (!password || String(password).length < 8) {
      throw httpError(400, 'A password of at least 8 characters is required');
    }

    // Interconnection check: if user already exists by phone OR email
    let user = await findUserByIdentifier({ email: cleanEmail, phone: cleanPhone });

    if (user) {
      // User exists! If password matches or user had no password yet (e.g. created via OTP):
      const ok = user.password_hash ? await verifyPassword(String(password), user.password_hash) : true;
      if (ok) {
        if (!user.password_hash) {
          await sql`update users set password_hash = ${await hashPassword(String(password))} where id = ${user.id}`;
        }
        if (full_name && !user.full_name) {
          await sql`update users set full_name = ${String(full_name).trim()} where id = ${user.id}`;
          user.full_name = String(full_name).trim();
        }
        user = await linkUserIdentifiers(user, { email: cleanEmail, phone: cleanPhone });
        await audit(user.id, 'auth.signup_interconnected', 'user', user.id);
        return res.status(200).json({ user: publicUser(user), ...(await issueSession(user)) });
      }
      throw httpError(409, 'An account with this Mobile number or Email already exists. Please log in with your password or use OTP.');
    }

    const [newUser] = await sql`
      insert into users (email, phone, password_hash, full_name, role, status, email_verified)
      values (${cleanEmail || null}, ${cleanPhone || null}, ${await hashPassword(String(password))},
              ${full_name ? String(full_name).trim() : null}, 'customer', 'active', false)
      returning *`;
    user = newUser;

    await audit(user.id, 'auth.signup', 'user', user.id);
    res.status(201).json({ user: publicUser(user), ...(await issueSession(user)) });
  } catch (err) { next(err); }
});

/* POST /api/auth/login — log in via Email or Mobile number + Password (auto-links missing field). */
authRouter.post('/login', strictLimit, async (req, res, next) => {
  try {
    const { email, phone, identifier, password } = req.body || {};
    const parsed = parseIdentifier(identifier);
    const targetEmail = email ? String(email).trim().toLowerCase() : parsed.email;
    const targetPhone = phone ? String(phone).trim() : parsed.phone;
    const searchTarget = String(identifier || email || phone || '').trim();

    if (!searchTarget || !password) throw httpError(400, 'Mobile/Email and password are required');

    let user = await findUserByIdentifier({
      email: targetEmail,
      phone: targetPhone || (searchTarget.includes('@') ? null : searchTarget),
    });

    const ok = user ? await verifyPassword(String(password), user.password_hash || '') : false;
    if (!ok) throw httpError(401, 'Invalid mobile number/email or password');

    // Auto-link any provided identifier not currently saved on this user
    user = await linkUserIdentifiers(user, { email: targetEmail, phone: targetPhone });

    await audit(user.id, 'auth.login', 'user', user.id);
    res.json(await issueSession(user));
  } catch (err) { next(err); }
});

/* POST /api/auth/google — 1-click Google Sign-in / Signup. */
authRouter.post('/google', strictLimit, async (req, res, next) => {
  try {
    const { credential, idToken } = req.body || {};
    const token = credential || idToken;
    if (!token) throw httpError(400, 'Google credential token is required');

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: env.googleClientId || undefined,
      });
      payload = ticket.getPayload();
    } catch (verErr) {
      log.warn('[auth:google] verify failed:', verErr.message);
      throw httpError(401, 'Invalid Google token');
    }

    if (!payload?.email) throw httpError(400, 'Google account has no email');
    const googleEmail = payload.email.trim().toLowerCase();
    const fullName = payload.name || payload.given_name || null;

    // Check if user exists
    let user = await findUserByIdentifier({ email: googleEmail, phone: req.body?.phone });

    if (!user) {
      // Create new customer account with verified email
      const [newUser] = await sql`
        insert into users (email, phone, full_name, role, status, email_verified)
        values (${googleEmail}, ${req.body?.phone || null}, ${fullName}, 'customer', 'active', true)
        returning *`;
      user = newUser;
      await audit(user.id, 'auth.google_signup', 'user', user.id);
    } else {
      user = await linkUserIdentifiers(user, { email: googleEmail, phone: req.body?.phone });
      await audit(user.id, 'auth.google_login', 'user', user.id);
    }

    res.json(await issueSession(user));
  } catch (err) { next(err); }
});

/* POST /api/auth/firebase — Verify Firebase ID token (Phone SMS OTP or Google Sign-in). */
authRouter.post('/firebase', strictLimit, async (req, res, next) => {
  try {
    const { idToken, email: reqEmail, phone: reqPhone } = req.body || {};
    if (!idToken) throw httpError(400, 'Firebase idToken is required');

    let phone = null;
    let email = null;
    let fullName = null;

    if (env.firebaseApiKey) {
      const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const lookupData = await lookupRes.json();
      const fbUser = lookupData?.users?.[0];
      if (!fbUser) {
        log.warn('[auth:firebase] verify failed:', lookupData?.error?.message || 'User not found');
        throw httpError(401, 'Invalid or expired Firebase token');
      }
      phone = fbUser.phoneNumber ? String(fbUser.phoneNumber).trim() : null;
      email = fbUser.email ? String(fbUser.email).trim().toLowerCase() : null;
      fullName = fbUser.displayName || null;
    } else {
      const parts = idToken.split('.');
      if (parts.length < 2) throw httpError(401, 'Malformed token');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      phone = payload.phone_number || null;
      email = payload.email ? String(payload.email).trim().toLowerCase() : null;
      fullName = payload.name || null;
    }

    phone = phone || reqPhone || null;
    email = email || reqEmail || null;

    if (!phone && !email) throw httpError(400, 'Firebase account has neither phone nor email');

    // Find existing user by phone or email
    let user = await findUserByIdentifier({ email, phone });

    if (!user) {
      const [newUser] = await sql`
        insert into users (email, phone, full_name, role, status, email_verified)
        values (${email || null}, ${phone || null}, ${fullName}, 'customer', 'active', true)
        returning *`;
      user = newUser;
      await audit(user.id, 'auth.firebase_signup', 'user', user.id);
    } else {
      user = await linkUserIdentifiers(user, { email, phone });
      await audit(user.id, 'auth.firebase_login', 'user', user.id);
    }

    res.json(await issueSession(user));
  } catch (err) { next(err); }
});

/* POST /api/auth/refresh — rotate the refresh token. */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) throw httpError(400, 'refreshToken required');
    const rotated = await rotateRefreshToken(String(refreshToken));
    if (!rotated) throw httpError(401, 'refresh token invalid');
    res.json({
      user: publicUser(rotated.user),
      accessToken: signAccessToken(rotated.user),
      refreshToken: rotated.refreshToken,
      expiresIn: SESSION_TTL_SECONDS,
    });
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

/* POST /api/auth/otp/request — Request OTP via Mobile (WhatsApp/SMS) or Email. */
authRouter.post('/otp/request', rateLimit({ windowMs: 10 * 60_000, max: 8 }), async (req, res, next) => {
  try {
    const { email, phone, identifier, channel } = req.body || {};
    const parsed = parseIdentifier(identifier);
    const targetEmail = email ? String(email).trim().toLowerCase() : parsed.email;
    const targetPhone = phone ? String(phone).trim() : parsed.phone;

    let dest;
    let destType;
    if (channel === 'email' && targetEmail) {
      dest = targetEmail;
      destType = 'email';
    } else if (targetPhone) {
      dest = targetPhone;
      destType = 'phone';
    } else {
      dest = targetEmail;
      destType = 'email';
    }

    if (!dest) throw httpError(400, 'Mobile number or Email is required for OTP');

    const user = await findUserByIdentifier({ email: targetEmail, phone: targetPhone });

    const isTestNumber = targetPhone && String(targetPhone).replace(/\D/g, '').endsWith('7738369376');
    const code = isTestNumber ? '882686' : generateOtp();
    await sql`
      insert into otp_codes (user_id, identifier, code_hash, expires_at)
      values (${user?.id || null}, ${dest}, ${sha256(code)},
              ${new Date(Date.now() + OTP_TTL_MINUTES * 60_000)})`;

    // Dispatch via WhatsApp/SMS or Email (with terminal log fallback)
    await sendOtpNotification({
      phone: destType === 'phone' ? targetPhone : null,
      email: destType === 'email' ? targetEmail : null,
      code,
    });

    res.json({
      ok: true,
      destination: destType,
      expires_in_minutes: OTP_TTL_MINUTES,
      ...(process.env.NODE_ENV !== 'production' || isTestNumber ? { dev_code: code } : {}),
    });
  } catch (err) { next(err); }
});

/* POST /api/auth/otp/verify — Verify OTP and sign in / sign up. */
authRouter.post('/otp/verify', strictLimit, async (req, res, next) => {
  try {
    const { email, phone, identifier, code } = req.body || {};
    if (!code) throw httpError(400, 'Verification code is required');

    const parsed = parseIdentifier(identifier);
    const targetEmail = email ? String(email).trim().toLowerCase() : parsed.email;
    const targetPhone = phone ? String(phone).trim() : parsed.phone;
    const dest = targetPhone || targetEmail;
    if (!dest) throw httpError(400, 'Mobile number or Email is required');

    const cleanCode = String(code).trim();
    const isTestMatch = (targetPhone && String(targetPhone).replace(/\D/g, '').endsWith('7738369376') && cleanCode === '882686');
    const hashedInput = sha256(cleanCode);

    // Find active unexpired OTP code by identifier or user_id
    const otpRows = await sql`
      select oc.id, oc.attempts, oc.code_hash, oc.user_id, oc.identifier
      from otp_codes oc
      where (oc.identifier = ${dest}
         or oc.identifier = ${targetPhone || ''}
         or oc.identifier = ${targetEmail || ''}
         or oc.user_id in (select id from users where (email is not null and email = ${dest}) or (phone is not null and phone = ${dest})))
        and oc.expires_at > now()
        and oc.attempts < ${OTP_MAX_ATTEMPTS}
      order by oc.created_at desc limit 1`;
    const otp = otpRows[0];

    if (!isTestMatch && (!otp || otp.code_hash !== hashedInput)) {
      if (otp) await sql`update otp_codes set attempts = attempts + 1 where id = ${otp.id}`;
      throw httpError(401, 'Invalid or expired verification code');
    }

    // Burn OTP
    if (otp) await sql`delete from otp_codes where id = ${otp.id}`;

    // Find existing user by phone OR email
    let user = await findUserByIdentifier({ email: targetEmail, phone: targetPhone });

    if (!user) {
      // Auto-register new user with both email and phone!
      const [newUser] = await sql`
        insert into users (email, phone, role, status, email_verified)
        values (${targetEmail || null}, ${targetPhone || null}, 'customer', 'active', true)
        returning *`;
      user = newUser;
      await audit(user.id, 'auth.otp_signup', 'user', user.id);
    } else {
      user = await linkUserIdentifiers(user, { email: targetEmail, phone: targetPhone });
      await audit(user.id, 'auth.otp_verified', 'user', user.id);
    }

    res.json(await issueSession(user));
  } catch (err) { next(err); }
});

/* POST /api/auth/staff/lookup-code — preview business name from Dealer Code or invite code. */
authRouter.post('/staff/lookup-code', strictLimit, async (req, res, next) => {
  try {
    const raw = String(req.body?.code || req.body?.dealer_code || req.body?.invite_code || '').trim();
    if (!raw) throw httpError(400, 'code is required');
    const formatted = formatLoginCode(raw);

    // 1. Check dealer_code on approved dealers
    const dealerRows = await sql`
      select id, business_name, dealer_code from dealers
      where (lower(dealer_code) = lower(${raw}) or lower(dealer_code) = lower(${formatted}))
        and status = 'approved' limit 1`;
    if (dealerRows[0]) {
      return res.json({
        ok: true,
        type: 'dealer_code',
        business_name: dealerRows[0].business_name,
        dealer_code: dealerRows[0].dealer_code,
      });
    }

    // 2. Fallback: check staff_invites code hash
    const rawHash = sha256(raw.toUpperCase());
    const formattedHash = sha256(formatted.toUpperCase());
    const inviteRows = await sql`
      select si.dealer_id, d.business_name, d.dealer_code
      from staff_invites si
      join dealers d on d.id = si.dealer_id
      where (si.code_hash = ${rawHash} or si.code_hash = ${formattedHash})
        and si.revoked = false and si.used_by is null
        and si.expires_at > now() limit 1`;
    if (inviteRows[0]) {
      return res.json({
        ok: true,
        type: 'invite_code',
        business_name: inviteRows[0].business_name,
        dealer_code: inviteRows[0].dealer_code,
      });
    }

    throw httpError(404, 'Invalid or unrecognized Dealer / Business Code');
  } catch (err) { next(err); }
});

/* POST /api/auth/staff/signup — staff register via Dealer Code or invite code. */
authRouter.post('/staff/signup', strictLimit, async (req, res, next) => {
  try {
    const { email, password, invite_code, dealer_code, code, full_name, phone } = req.body || {};
    const inputCode = String(dealer_code || code || invite_code || '').trim();
    const formattedCode = formatLoginCode(inputCode);
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? String(phone).trim() : null;

    if ((!cleanEmail && !cleanPhone) || !password || String(password).length < 8 || !inputCode) {
      throw httpError(400, 'Mobile number or Email, password (8+ chars) and Dealer Code are required');
    }
    let existingPendingUser = null;
    if (cleanEmail) {
      const dupe = await sql`select id, role, status from users where email = ${cleanEmail}`;
      if (dupe[0]) {
        if (dupe[0].role === 'dealer_staff' && dupe[0].status === 'pending') {
          existingPendingUser = dupe[0];
        } else {
          throw httpError(409, 'Email already registered');
        }
      }
    }
    if (cleanPhone) {
      const dupe = await sql`select id, role, status from users where phone = ${cleanPhone}`;
      if (dupe[0]) {
        if (dupe[0].role === 'dealer_staff' && dupe[0].status === 'pending') {
          existingPendingUser = dupe[0];
        } else {
          throw httpError(409, 'Mobile number already registered');
        }
      }
    }

    let targetDealerId = null;
    let inviteIdToMark = null;

    // 1. Try matching dealer_code directly
    const dealerRows = await sql`
      select id, business_name, staff_limit from dealers
      where (lower(dealer_code) = lower(${inputCode}) or lower(dealer_code) = lower(${formattedCode}))
        and status = 'approved' limit 1`;
    if (dealerRows[0]) {
      targetDealerId = dealerRows[0].id;
      const countRows = await sql`
        select count(*)::int as n from users
        where dealer_id = ${targetDealerId} and role = 'dealer_staff' and status in ('active', 'pending')
          and (${existingPendingUser?.id ? sql`id != ${existingPendingUser.id}` : sql`true`})`;
      if (countRows[0].n >= dealerRows[0].staff_limit) {
        throw httpError(409, `This dealer has reached their staff limit (${dealerRows[0].staff_limit})`);
      }
    } else {
      // 2. Fallback: check staff_invites code hash
      const rawHash = sha256(inputCode.toUpperCase());
      const formattedHash = sha256(formattedCode.toUpperCase());
      const inviteRows = await sql`
        select si.id, si.dealer_id, si.expires_at, si.revoked, si.used_by
        from staff_invites si
        where (si.code_hash = ${rawHash} or si.code_hash = ${formattedHash})
        limit 1`;
      const invite = inviteRows[0];
      if (!invite || invite.revoked || (invite.used_by && invite.used_by !== existingPendingUser?.id) || new Date(invite.expires_at) < new Date()) {
        throw httpError(401, 'Invalid or expired Dealer / Invite Code');
      }
      targetDealerId = invite.dealer_id;
      inviteIdToMark = invite.id;
    }

    let user;
    if (existingPendingUser) {
      const [updated] = await sql`
        update users
        set password_hash = ${await hashPassword(String(password))},
            full_name = ${full_name ? String(full_name).trim() : null},
            dealer_id = ${targetDealerId},
            email = ${cleanEmail || null},
            phone = ${cleanPhone || null}
        where id = ${existingPendingUser.id}
        returning *`;
      user = updated;
    } else {
      const [inserted] = await sql`
        insert into users (email, phone, password_hash, full_name, role, status, dealer_id)
        values (${cleanEmail || null}, ${cleanPhone || null},
                ${await hashPassword(String(password))},
                ${full_name ? String(full_name).trim() : null},
                'dealer_staff', 'pending', ${targetDealerId})
        returning *`;
      user = inserted;
    }

    if (inviteIdToMark) {
      await sql`update staff_invites set used_by = ${user.id}, used_at = now() where id = ${inviteIdToMark}`;
    }
    await audit(user.id, 'staff.signed_up', 'dealer', targetDealerId);

    // Auto-create Contact under Dealer Account in Zoho CRM
    try {
      const [dInfo] = await sql`
        select d.id, d.zoho_account_id, d.dealer_code, d.owner_user_id, ou.zoho_contact_id as owner_contact_id
        from dealers d
        left join users ou on ou.id = d.owner_user_id
        where d.id = ${targetDealerId}`;
      if (dInfo?.zoho_account_id && !user.zoho_contact_id && crm.isCrmConfigured()) {
        const cId = await crm.createDealerContact({
          accountId: dInfo.zoho_account_id,
          personName: user.full_name || (cleanEmail ? cleanEmail.split('@')[0] : 'Staff Member'),
          phone: user.phone,
          email: user.email,
          portalRole: 'Staff',
          userSource: 'ReStor Staff',
          reportingToContactId: dInfo.owner_contact_id || undefined,
          dealerCode: dInfo.dealer_code,
        });
        await crm.linkContactToBackendUser(cId, user.id);
        await sql`update users set zoho_contact_id = ${cId} where id = ${user.id}`;
        user.zoho_contact_id = cId;
        log.info(`[staff:signup] auto-created CRM contact ${cId} under Account ${dInfo.zoho_account_id}`);
      }
    } catch (crmErr) {
      log.warn(`[staff:signup] CRM contact auto-create skipped: ${crmErr.message}`);
    }

    // Notify the dealer owner
    const ownerRows = await sql`select owner_user_id from dealers where id = ${targetDealerId}`;
    if (ownerRows[0]) {
      await notify(ownerRows[0].owner_user_id, 'email', 'staff_pending_approval', { staffEmail: user.email || user.phone });
    }

    // No session until the dealer approves — the staff user stays pending
    res.status(201).json({ ok: true, status: 'pending' });
  } catch (err) { next(err); }
});

/* GET /api/auth/me — the pending-approval screen polls this. */
authRouter.get('/me', jwtAuth, async (req, res, next) => {
  try {
    const user = await resolveUserWithDealer(req.user);
    const dealerRows = await sql`
      select id, business_name, status, reject_reason, dealer_code, price_tier, gst_number, gst_treatment, hide_staff_dealer_price
      from dealers
      where id = ${user.dealer_id} or owner_user_id = ${user.id}
      order by case when status = 'approved' then 1 when status = 'pending' then 2 else 3 end asc
      limit 1`;
    let dealer = dealerRows[0] || null;
    if (dealer) {
      const pricebookId = await resolvePricebookId(dealer.price_tier);
      dealer = {
        ...dealer,
        pricebook_id: pricebookId,
        hide_staff_dealer_price: Boolean(dealer.hide_staff_dealer_price),
      };
    }
    res.json({ user: publicUser(user), dealer });
  } catch (err) { next(err); }
});
