import crypto from 'node:crypto';
import { sql } from '../db/pool.js';
import { audit } from '../utils/audit.js';
import { log } from '../utils/logger.js';
import * as crm from './crmClient.js';
import { ensureContactPricebookForCrmAccount } from './commerceClient.js';
import { generateUniqueDealerCode } from '../utils/loginCode.js';
import { normalizePhone } from '../utils/phone.js';
import { normalizeEmail, isValidPhone, isValidEmail, cleanName, isValidGstin, isValidName } from '../utils/validators.js';
import { generateOtp, hashOtp, verifyOtpHash } from '../utils/hash.js';
import { sendEmailOtp, sendWhatsAppOtp } from './notifications.js';
import { httpError } from '../middleware/errorHandler.js';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;

/**
 * Server-enforced contact-level OTP cooldown.
 * Keyed by normalized recipient (phone or email), independent of IP address,
 * flowId, and whether the caller starts a new registration flow.
 * Uses atomic PostgreSQL upsert with conditional WHERE to guarantee that
 * concurrent requests cannot bypass the cooldown.
 */
async function acquireContactOtpCooldown(sqlClient, contactKey) {
  const acquired = await sqlClient`
    insert into dealer_otp_cooldowns (contact, last_sent_at)
    values (${contactKey}, now())
    on conflict (contact) do update
      set last_sent_at = excluded.last_sent_at
      where dealer_otp_cooldowns.last_sent_at <= now() - interval '60 seconds'
    returning last_sent_at`;

  if (!acquired || acquired.length === 0) {
    const existing = await sqlClient`
      select last_sent_at from dealer_otp_cooldowns where contact = ${contactKey} limit 1`;
    const lastSent = existing[0]?.last_sent_at ? new Date(existing[0].last_sent_at).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastSent) / 1000));
    const remaining = Math.max(1, OTP_COOLDOWN_SECONDS - elapsedSeconds);
    const err = httpError(429, `Please wait ${remaining} seconds before requesting another verification code.`);
    err.retry_after_seconds = remaining;
    throw err;
  }
}

async function releaseContactOtpCooldown(sqlClient, contactKey) {
  await sqlClient`delete from dealer_otp_cooldowns where contact = ${contactKey}`.catch(() => {});
}

/**
 * Provisions a dealer and its owner contact in Zoho CRM.
 * Executed STRICTLY OUTSIDE the internal database transaction.
 * If CRM is unreachable, logs/audits the failure and leaves zoho ids null
 * so crmPoll automatically retries without losing the pending application.
 */
export async function provisionDealerInCrm({
  dealerId,
  dealerCode,
  user,
  businessName,
  gstNumber,
  gstTreatment,
  address,
  city,
  state,
  pin,
  pincode,
  personName,
  firstName,
  lastName,
  phone,
}) {
  let zohoAccountId = null;
  const effectivePhone = (phone ? String(phone).trim() : null) || user.phone || null;
  const combinedName = personName || [firstName, lastName].filter(Boolean).join(' ') || user.full_name || null;

  try {
    zohoAccountId = await crm.createDealerAccount({
      businessName,
      gstNumber,
      gstTreatment,
      phone: effectivePhone,
      email: user.email,
      address,
      city,
      state,
      pin: pin || pincode,
      pincode: pincode || pin,
      userSource: 'ReStor Dealer',
      dealerCode,
    });
    if (zohoAccountId) {
      await sql`update dealers set zoho_account_id = ${zohoAccountId} where id = ${dealerId}`;
    }
    const contactId = await crm.createDealerContact({
      accountId: zohoAccountId,
      personName: combinedName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      phone: effectivePhone,
      email: user.email,
      portalRole: 'Owner',
      userSource: 'ReStor Dealer',
      dealerCode,
      backendUserId: user.id,
    });
    await crm.linkContactToBackendUser(contactId, user.id);
    await sql`update users set zoho_contact_id = ${contactId} where id = ${user.id}`;
    ensureContactPricebookForCrmAccount(zohoAccountId).catch(() => {});
    return { zohoAccountId, contactId };
  } catch (err) {
    if (err.message === 'CRM_NOT_CONFIGURED') {
      log.warn(`[dealerApp] CRM not configured — dealer ${dealerId} stays pending for crmPoll`);
    } else {
      log.error(`[dealerApp] CRM create failed for dealer ${dealerId}:`, err.message);
    }
    await audit(user.id, 'dealer.crm_create_failed', 'dealer', dealerId, { error: err.message });
    throw err;
  }
}

/**
 * Dealer application for already-authenticated users:
 * 1. persist as pending
 * 2. create Account + Contact in Zoho CRM
 */
export async function applyDealer({ user, businessName, gstNumber, gstTreatment, address, personName, firstName, lastName, phone }) {
  const existing = await sql`select id from dealers where owner_user_id = ${user.id}`;
  if (existing.length) {
    throw Object.assign(new Error('Dealer application already exists'), { statusCode: 409 });
  }

  const effectivePhone = (phone ? String(phone).trim() : null) || user.phone || null;
  const combinedName = personName || [firstName, lastName].filter(Boolean).join(' ') || user.full_name || null;

  // Auto-generate official Dealer Code in DE-ABC-1234 format
  const dealerCode = await generateUniqueDealerCode(sql, 'DE');

  const [dealer] = await sql`
    insert into dealers (owner_user_id, business_name, gst_number, gst_treatment, address, status, dealer_code)
    values (${user.id}, ${businessName}, ${gstNumber || null}, ${gstTreatment || null}, ${address || null}, 'pending', ${dealerCode})
    returning id, dealer_code`;

  await sql`update users set role = 'dealer', status = 'pending', dealer_id = ${dealer.id},
            full_name = coalesce(full_name, ${combinedName}),
            phone = coalesce(phone, ${effectivePhone}) where id = ${user.id}`;

  let zohoAccountId = null;
  try {
    const res = await provisionDealerInCrm({
      dealerId: dealer.id,
      dealerCode,
      user,
      businessName,
      gstNumber,
      gstTreatment,
      address,
      personName,
      firstName,
      lastName,
      phone: effectivePhone,
    });
    zohoAccountId = res?.zohoAccountId || null;
  } catch {
    // Non-fatal: logged and audited inside provisionDealerInCrm
  }

  await audit(user.id, 'dealer.applied', 'dealer', dealer.id, { businessName, gstNumber, gstTreatment, zohoAccountId });
  return dealer.id;
}

/**
 * Request OTP for guest dealer registration.
 * Channel can be 'phone' (WhatsApp OTP) or 'email' (Email OTP).
 * Binds both channels to the temporary dealer_registration_flows row.
 * Writes ZERO permanent records to users, dealers, or Zoho CRM.
 */
export async function requestDealerRegistrationOtp({ flowId, channel, phone, email, user }) {
  if (!channel || !['phone', 'email'].includes(channel)) {
    throw httpError(400, 'Channel must be either "phone" or "email"');
  }

  if (channel === 'phone') {
    if (!phone) throw httpError(400, 'Mobile phone number is required');
    const norm = normalizePhone(phone);
    if (!isValidPhone(phone) || !norm.nationalNumber) {
      throw httpError(400, 'Please enter a valid 10-digit Indian mobile number');
    }

    // Check duplicate in users or dealers (only block if already a dealer or staff)
    const existing = await sql`
      select u.id, u.role, d.status as dealer_status
      from users u
      left join dealers d on d.owner_user_id = u.id or d.id = u.dealer_id
      where (u.phone = ${norm.nationalNumber}
         or u.phone = ${norm.e164}
         or u.phone like ${`%${norm.nationalNumber}`})
        and (u.role = 'dealer' or u.role = 'dealer_staff' or d.id is not null)
      limit 1`;
    if (existing.length > 0) {
      throw httpError(409, 'A dealer account with this phone number already exists. Please log in.');
    }

    let flow;
    if (flowId) {
      const rows = await sql`
        select * from dealer_registration_flows
        where id = ${flowId} and consumed_at is null and expires_at > now()
        limit 1`;
      flow = rows[0];
      if (!flow) {
        throw httpError(400, 'Invalid or expired registration session. Please start over.');
      }
      if (flow.phone_verified) {
        if (flow.phone === norm.nationalNumber) {
          return { ok: true, flowId: flow.id, already_verified: true, phone_verified: true };
        }
        throw httpError(400, 'Phone number cannot be changed once verified. Start a new registration to use a different number.');
      }
    }

    // Server-enforced contact cooldown check & atomic reservation
    const contactKey = `phone:${norm.nationalNumber}`;
    await acquireContactOtpCooldown(sql, contactKey);

    if (!flow) {
      let preverifiedEmail = (user?.email_verified && user?.email)
        ? normalizeEmail(user.email)
        : (email ? normalizeEmail(email) : null);
      let isEmailVerified = Boolean(user?.email_verified && user?.email);

      if (!isEmailVerified && preverifiedEmail) {
        const matchingUser = await sql`
          select id, email_verified from users
          where lower(email) = ${preverifiedEmail} and email_verified = true
          limit 1`;
        if (matchingUser.length > 0) {
          isEmailVerified = true;
        }
      }

      const [newFlow] = await sql`
        insert into dealer_registration_flows (
          phone,
          email,
          email_verified,
          email_verified_at,
          expires_at
        )
        values (
          ${norm.nationalNumber},
          ${preverifiedEmail || null},
          ${isEmailVerified},
          ${isEmailVerified ? sql`now()` : null},
          now() + interval '30 minutes'
        )
        returning *`;
      flow = newFlow;
    } else if (!flow.email_verified) {
      let preverifiedEmail = (user?.email_verified && user?.email)
        ? normalizeEmail(user.email)
        : (email ? normalizeEmail(email) : null);
      let isEmailVerified = Boolean(user?.email_verified && user?.email);

      if (!isEmailVerified && preverifiedEmail) {
        const matchingUser = await sql`
          select id, email_verified from users
          where lower(email) = ${preverifiedEmail} and email_verified = true
          limit 1`;
        if (matchingUser.length > 0) {
          isEmailVerified = true;
        }
      }

      if (isEmailVerified && preverifiedEmail) {
        await sql`
          update dealer_registration_flows
          set email = coalesce(email, ${preverifiedEmail}),
              email_verified = true,
              email_verified_at = coalesce(email_verified_at, now())
          where id = ${flow.id}`;
        flow.email = flow.email || preverifiedEmail;
        flow.email_verified = true;
      }
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    const codeHash = hashOtp(code, norm.nationalNumber);

    await sql`
      update dealer_registration_flows
      set phone = ${norm.nationalNumber},
          phone_otp_hash = ${codeHash},
          phone_otp_expires_at = ${expiresAt},
          phone_attempts = 0
      where id = ${flow.id}`;

    try {
      await sendWhatsAppOtp({ phone: norm.nationalNumber, code });
      return {
        ok: true,
        flowId: flow.id,
        destination: 'phone',
        expires_in_minutes: OTP_TTL_MINUTES,
        ...(process.env.ENABLE_DEV_OTP === 'true' ? { dev_code: code } : {}),
      };
    } catch (sendErr) {
      await releaseContactOtpCooldown(sql, contactKey);
      await sql`update dealer_registration_flows set phone_otp_hash = null where id = ${flow.id}`.catch(() => {});
      throw sendErr;
    }
  }

  if (channel === 'email') {
    if (!email) throw httpError(400, 'Email address is required');
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      throw httpError(400, 'Please enter a valid email address');
    }

    const existing = await sql`
      select u.id, u.role, d.status as dealer_status
      from users u
      left join dealers d on d.owner_user_id = u.id or d.id = u.dealer_id
      where lower(u.email) = ${cleanEmail}
        and (u.role = 'dealer' or u.role = 'dealer_staff' or d.id is not null)
      limit 1`;
    if (existing.length > 0) {
      throw httpError(409, 'A dealer account with this email address already exists. Please log in.');
    }

    let flow;
    if (flowId) {
      const rows = await sql`
        select * from dealer_registration_flows
        where id = ${flowId} and consumed_at is null and expires_at > now()
        limit 1`;
      flow = rows[0];
      if (!flow) {
        throw httpError(400, 'Invalid or expired registration session. Please start over.');
      }
      if (flow.email_verified) {
        if (flow.email === cleanEmail) {
          return { ok: true, flowId: flow.id, already_verified: true, email_verified: true };
        }
        throw httpError(400, 'Email address cannot be changed once verified. Start a new registration to use a different address.');
      }
    }

    // Server-enforced contact cooldown check & atomic reservation
    const contactKey = `email:${cleanEmail}`;
    await acquireContactOtpCooldown(sql, contactKey);

    if (!flow) {
      let normUserPhone = (user?.phone_verified && user?.phone)
        ? normalizePhone(user.phone).nationalNumber
        : (phone ? normalizePhone(phone).nationalNumber : null);
      let isPhoneVerified = Boolean(user?.phone_verified && user?.phone);

      if (!isPhoneVerified && normUserPhone) {
        const matchingUser = await sql`
          select id, phone_verified from users
          where (phone = ${normUserPhone} or phone = ${'+91' + normUserPhone} or phone like ${'%' + normUserPhone})
            and phone_verified = true
          limit 1`;
        if (matchingUser.length > 0) {
          isPhoneVerified = true;
        }
      }

      const [newFlow] = await sql`
        insert into dealer_registration_flows (
          email,
          phone,
          phone_verified,
          phone_verified_at,
          expires_at
        )
        values (
          ${cleanEmail},
          ${normUserPhone || null},
          ${isPhoneVerified},
          ${isPhoneVerified ? sql`now()` : null},
          now() + interval '30 minutes'
        )
        returning *`;
      flow = newFlow;
    } else if (!flow.phone_verified) {
      let normUserPhone = (user?.phone_verified && user?.phone)
        ? normalizePhone(user.phone).nationalNumber
        : (phone ? normalizePhone(phone).nationalNumber : null);
      let isPhoneVerified = Boolean(user?.phone_verified && user?.phone);

      if (!isPhoneVerified && normUserPhone) {
        const matchingUser = await sql`
          select id, phone_verified from users
          where (phone = ${normUserPhone} or phone = ${'+91' + normUserPhone} or phone like ${'%' + normUserPhone})
            and phone_verified = true
          limit 1`;
        if (matchingUser.length > 0) {
          isPhoneVerified = true;
        }
      }

      if (isPhoneVerified && normUserPhone) {
        await sql`
          update dealer_registration_flows
          set phone = coalesce(phone, ${normUserPhone}),
              phone_verified = true,
              phone_verified_at = coalesce(phone_verified_at, now())
          where id = ${flow.id}`;
        flow.phone = flow.phone || normUserPhone;
        flow.phone_verified = true;
      }
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    const codeHash = hashOtp(code, cleanEmail);

    await sql`
      update dealer_registration_flows
      set email = ${cleanEmail},
          email_otp_hash = ${codeHash},
          email_otp_expires_at = ${expiresAt},
          email_attempts = 0
      where id = ${flow.id}`;

    try {
      await sendEmailOtp({ email: cleanEmail, code });
      return {
        ok: true,
        flowId: flow.id,
        destination: 'email',
        expires_in_minutes: OTP_TTL_MINUTES,
        ...(process.env.ENABLE_DEV_OTP === 'true' ? { dev_code: code } : {}),
      };
    } catch (sendErr) {
      await releaseContactOtpCooldown(sql, contactKey);
      await sql`update dealer_registration_flows set email_otp_hash = null where id = ${flow.id}`.catch(() => {});
      throw sendErr;
    }
  }
}

/**
 * Verify OTP for guest dealer registration.
 * Enforces 5-attempt limit, short expiry, single-use, and binds verification to flow.
 * If both channels become verified, issues a server-controlled verification_token.
 * Writes ZERO permanent records to users, dealers, or Zoho CRM.
 */
export async function verifyDealerRegistrationOtp({ flowId, channel, phone, email, code, user }) {
  if (!flowId) throw httpError(400, 'Registration session ID (flowId) is required');
  if (!channel || !['phone', 'email'].includes(channel)) {
    throw httpError(400, 'Channel must be either "phone" or "email"');
  }

  const cleanCode = String(code || '').trim();
  if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
    throw httpError(400, 'A valid 6-digit verification code is required');
  }

  let rawVerificationToken = null;
  let result;

  const rows = await sql`
    select * from dealer_registration_flows
    where id = ${flowId} and consumed_at is null and expires_at > now()
    limit 1`;
  const flow = rows[0];
  if (!flow) {
    throw httpError(400, 'Invalid or expired registration session');
  }

  if (channel === 'phone') {
    const norm = normalizePhone(phone || flow.phone);
    if (!norm.nationalNumber) {
      throw httpError(400, 'Valid mobile phone number is required');
    }
    if (flow.phone && flow.phone !== norm.nationalNumber) {
      throw httpError(400, 'Phone number does not match this registration session');
    }
    if (flow.phone_verified) {
      result = flow;
    } else {
      if (flow.phone_attempts >= OTP_MAX_ATTEMPTS) {
        await sql`update dealer_registration_flows set phone_otp_hash = null where id = ${flow.id}`;
        throw httpError(429, 'Too many failed verification attempts. Please request a new code.');
      }
      if (!flow.phone_otp_hash || new Date(flow.phone_otp_expires_at) < new Date()) {
        throw httpError(401, 'Invalid or expired verification code');
      }
      if (!verifyOtpHash(cleanCode, flow.phone_otp_hash, flow.phone || norm.nationalNumber)) {
        const nextAttempts = (flow.phone_attempts || 0) + 1;
        if (nextAttempts >= OTP_MAX_ATTEMPTS) {
          await sql`update dealer_registration_flows set phone_otp_hash = null, phone_attempts = ${nextAttempts} where id = ${flow.id}`;
          throw httpError(429, 'Too many failed verification attempts. Please request a new code.');
        }
        await sql`update dealer_registration_flows set phone_attempts = ${nextAttempts} where id = ${flow.id}`;
        const remaining = OTP_MAX_ATTEMPTS - nextAttempts;
        throw httpError(401, `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }

      if (!flow.email_verified) {
        let preverifiedEmail = (user?.email_verified && user?.email)
          ? normalizeEmail(user.email)
          : (email ? normalizeEmail(email) : flow.email);
        let isEmailVerified = Boolean(user?.email_verified && user?.email);

        if (!isEmailVerified && preverifiedEmail) {
          const matchingUser = await sql`
            select id, email_verified from users
            where lower(email) = ${preverifiedEmail} and email_verified = true
            limit 1`;
          if (matchingUser.length > 0) {
            isEmailVerified = true;
          }
        }

        if (isEmailVerified && preverifiedEmail) {
          await sql`
            update dealer_registration_flows
            set email = coalesce(email, ${preverifiedEmail}),
                email_verified = true,
                email_verified_at = coalesce(email_verified_at, now())
            where id = ${flow.id}`;
          flow.email = flow.email || preverifiedEmail;
          flow.email_verified = true;
        }
      }

      let tokenHashToSave = null;
      if (flow.email_verified && !flow.verification_token_hash) {
        rawVerificationToken = crypto.randomBytes(32).toString('hex');
        tokenHashToSave = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
      }

      await sql`
        update dealer_registration_flows
        set phone = ${norm.nationalNumber},
            phone_verified = true,
            phone_verified_at = now(),
            phone_otp_hash = null,
            verification_token_hash = coalesce(verification_token_hash, ${tokenHashToSave || null})
        where id = ${flow.id}`;

      result = {
        ...flow,
        phone: norm.nationalNumber,
        phone_verified: true,
        verification_token_hash: tokenHashToSave || flow.verification_token_hash,
      };
    }
  } else if (channel === 'email') {
    const cleanEmail = normalizeEmail(email || flow.email);
    if (!cleanEmail) {
      throw httpError(400, 'Valid email address is required');
    }
    if (flow.email && flow.email !== cleanEmail) {
      throw httpError(400, 'Email address does not match this registration session');
    }
    if (flow.email_verified) {
      result = flow;
    } else {
      if (flow.email_attempts >= OTP_MAX_ATTEMPTS) {
        await sql`update dealer_registration_flows set email_otp_hash = null where id = ${flow.id}`;
        throw httpError(429, 'Too many failed verification attempts. Please request a new code.');
      }
      if (!flow.email_otp_hash || new Date(flow.email_otp_expires_at) < new Date()) {
        throw httpError(401, 'Invalid or expired verification code');
      }
      if (!verifyOtpHash(cleanCode, flow.email_otp_hash, flow.email || cleanEmail)) {
        const nextAttempts = (flow.email_attempts || 0) + 1;
        if (nextAttempts >= OTP_MAX_ATTEMPTS) {
          await sql`update dealer_registration_flows set email_otp_hash = null, email_attempts = ${nextAttempts} where id = ${flow.id}`;
          throw httpError(429, 'Too many failed verification attempts. Please request a new code.');
        }
        await sql`update dealer_registration_flows set email_attempts = ${nextAttempts} where id = ${flow.id}`;
        const remaining = OTP_MAX_ATTEMPTS - nextAttempts;
        throw httpError(401, `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
      }

      if (!flow.phone_verified) {
        let normUserPhone = (user?.phone_verified && user?.phone)
          ? normalizePhone(user.phone).nationalNumber
          : (phone ? normalizePhone(phone).nationalNumber : flow.phone);
        let isPhoneVerified = Boolean(user?.phone_verified && user?.phone);

        if (!isPhoneVerified && normUserPhone) {
          const matchingUser = await sql`
            select id, phone_verified from users
            where (phone = ${normUserPhone} or phone = ${'+91' + normUserPhone} or phone like ${'%' + normUserPhone})
              and phone_verified = true
            limit 1`;
          if (matchingUser.length > 0) {
            isPhoneVerified = true;
          }
        }

        if (isPhoneVerified && normUserPhone) {
          await sql`
            update dealer_registration_flows
            set phone = coalesce(phone, ${normUserPhone}),
                phone_verified = true,
                phone_verified_at = coalesce(phone_verified_at, now())
            where id = ${flow.id}`;
          flow.phone = flow.phone || normUserPhone;
          flow.phone_verified = true;
        }
      }

      let tokenHashToSave = null;
      if (flow.phone_verified && !flow.verification_token_hash) {
        rawVerificationToken = crypto.randomBytes(32).toString('hex');
        tokenHashToSave = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
      }

      await sql`
        update dealer_registration_flows
        set email = ${cleanEmail},
            email_verified = true,
            email_verified_at = now(),
            email_otp_hash = null,
            verification_token_hash = coalesce(verification_token_hash, ${tokenHashToSave || null})
        where id = ${flow.id}`;

      result = {
        ...flow,
        email: cleanEmail,
        email_verified: true,
        verification_token_hash: tokenHashToSave || flow.verification_token_hash,
      };
    }
  }

  return {
    ok: true,
    flowId,
    phone_verified: Boolean(result.phone_verified),
    email_verified: Boolean(result.email_verified),
    both_verified: Boolean(result.phone_verified && result.email_verified),
    ...(rawVerificationToken ? { verification_token: rawVerificationToken } : {}),
  };
}

/**
 * Finalize guest dealer registration:
 * 1. PostgreSQL transaction:
 *    - Validates flow state (both channels verified, unconsumed, unexpired, matching contacts)
 *    - Validates verification token
 *    - Consumes flow atomically
 *    - Generates unique Dealer Code
 *    - Inserts user and dealer rows
 * 2. Outside transaction (post-commit):
 *    - Triggers Zoho CRM Account & Contact provisioning
 *    - If Zoho fails, logs & preserves application for crmPoll recovery
 * Returns { user, dealer }
 */
export async function finalizeDealerRegistration(params) {
  const flowId = params?.flowId || params?.flow_id;
  const verificationToken = params?.verificationToken || params?.verification_token;
  const authUser = params?.user;
  const {
    business_name,
    person_name,
    first_name,
    last_name,
    phone,
    email,
    gst_treatment,
    gst_number,
    address,
    city,
    state,
    pin,
    pincode,
  } = params || {};
  if (!flowId) throw httpError(400, 'Registration session ID (flowId) is required');
  if (!business_name || String(business_name).trim().length < 2) {
    throw httpError(400, 'Business / Shop name is required (min 2 characters)');
  }
  if (first_name && !isValidName(first_name)) {
    throw httpError(400, 'First name should contain letters only (min 2 characters)');
  }
  if (last_name && !isValidName(last_name)) {
    throw httpError(400, 'Last name should contain letters only (min 2 characters)');
  }
  if (gst_treatment?.includes('Registered') && (!gst_number || !isValidGstin(gst_number))) {
    throw httpError(400, 'Please enter a valid 15-character GSTIN (e.g. 27AABCR1234D1Z5)');
  }

  const normPhone = normalizePhone(phone);
  if (!phone || !isValidPhone(phone) || !normPhone.nationalNumber) {
    throw httpError(400, 'Please enter a valid 10-digit mobile number');
  }

  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    throw httpError(400, 'A valid email address is required');
  }

  const cleanFirst = first_name ? cleanName(first_name) : null;
  const cleanLast = last_name ? cleanName(last_name) : null;
  const cleanPerson = person_name ? cleanName(person_name) : ([cleanFirst, cleanLast].filter(Boolean).join(' ') || null);
  const cleanBusinessName = cleanName(business_name);
  const cleanCity = city ? String(city).trim() : null;
  const cleanState = state ? String(state).trim() : null;
  const cleanPin = (pincode || pin) ? String(pincode || pin).trim() : null;

  let createdUser, createdDealer;

  // 1. ATOMIC INTERNAL DATABASE TRANSACTION
  await sql.begin(async (tx) => {
    const flows = await tx`
      select * from dealer_registration_flows
      where id = ${flowId}
      for update`;
    let flow = flows[0];
    if (!flow) {
      throw httpError(400, 'Invalid or expired registration session');
    }
    if (flow.consumed_at) {
      throw httpError(409, 'This registration session has already been completed. Please log in.');
    }
    if (new Date(flow.expires_at) < new Date()) {
      throw httpError(400, 'Registration session has expired. Please start over.');
    }

    // Authenticated session reconciliation:
    // If applicant already has verified phone or email on user record, link to registration flow
    if (!flow.phone_verified) {
      const verifiedPhoneUser = await tx`
        select id, phone_verified from users
        where (phone = ${normPhone.nationalNumber} or phone = ${normPhone.e164} or phone like ${'%' + normPhone.nationalNumber})
          and phone_verified = true
        limit 1`;
      if (verifiedPhoneUser.length > 0 && (!authUser || authUser.id === verifiedPhoneUser[0].id || authUser.phone === normPhone.nationalNumber || authUser.phone === normPhone.e164)) {
        flow.phone = normPhone.nationalNumber;
        flow.phone_verified = true;
        await tx`update dealer_registration_flows set phone = ${normPhone.nationalNumber}, phone_verified = true, phone_verified_at = now() where id = ${flow.id}`;
      }
    }
    if (!flow.email_verified) {
      const verifiedEmailUser = await tx`
        select id, email_verified from users
        where lower(email) = ${cleanEmail} and email_verified = true
        limit 1`;
      if (verifiedEmailUser.length > 0 && (!authUser || authUser.id === verifiedEmailUser[0].id || authUser.email === cleanEmail)) {
        flow.email = cleanEmail;
        flow.email_verified = true;
        await tx`update dealer_registration_flows set email = ${cleanEmail}, email_verified = true, email_verified_at = now() where id = ${flow.id}`;
      }
    }

    if (!flow.phone_verified || !flow.email_verified) {
      throw httpError(400, 'Both phone and email verification are required before completing registration');
    }
    if (flow.phone !== normPhone.nationalNumber) {
      throw httpError(400, 'Submitted phone number does not match the verified phone in this registration session');
    }
    if (flow.email !== cleanEmail) {
      throw httpError(400, 'Submitted email address does not match the verified email in this registration session');
    }

    // Token validation: For guests, verification_token is strictly checked.
    // For authenticated users who verified their credentials at login, token mismatch is bypassed safely.
    const authPhoneNorm = authUser?.phone ? normalizePhone(authUser.phone).nationalNumber : null;
    const isAuthenticatedAccount = Boolean(
      authUser && (
        (authPhoneNorm && authPhoneNorm === normPhone.nationalNumber) ||
        (authUser.email && normalizeEmail(authUser.email) === cleanEmail)
      )
    );

    if (flow.verification_token_hash) {
      const rawSuppliedToken = String(verificationToken || '').trim();
      if (!rawSuppliedToken && isAuthenticatedAccount) {
        // Authenticated user session; token verified
      } else {
        if (!rawSuppliedToken) {
          throw httpError(401, 'Invalid or mismatched verification token');
        }
        const suppliedHash = crypto.createHash('sha256').update(rawSuppliedToken).digest('hex');
        const expectedBuf = Buffer.from(flow.verification_token_hash, 'utf8');
        const suppliedBuf = Buffer.from(suppliedHash, 'utf8');

        if (expectedBuf.length !== suppliedBuf.length || !crypto.timingSafeEqual(expectedBuf, suppliedBuf)) {
          if (!isAuthenticatedAccount) {
            throw httpError(401, 'Invalid or mismatched verification token');
          }
        }
      }
    } else if (!isAuthenticatedAccount) {
      const existingVerifiedUser = await tx`
        select id from users
        where (phone = ${normPhone.nationalNumber} and phone_verified = true)
           or (lower(email) = ${cleanEmail} and email_verified = true)
        limit 1`;
      if (existingVerifiedUser.length === 0) {
        throw httpError(401, 'Verification token has not been issued for this registration session');
      }
    }

    // Duplicate account check: block if already a dealer or dealer_staff
    const dupes = await tx`
      select id, role, dealer_id from users
      where lower(email) = ${cleanEmail}
         or phone = ${normPhone.nationalNumber}
         or phone = ${normPhone.e164}
         or phone like ${`%${normPhone.nationalNumber}`}
      limit 1`;
    const existingUser = dupes[0];
    if (existingUser && (existingUser.role === 'dealer' || existingUser.role === 'dealer_staff' || existingUser.dealer_id)) {
      throw httpError(409, 'A dealer account with this email or phone is already registered. Please log in.');
    }

    // Mark flow consumed atomically
    await tx`
      update dealer_registration_flows
      set consumed_at = now()
      where id = ${flowId} and consumed_at is null`;

    // Generate unique Dealer Code
    const dealerCode = await generateUniqueDealerCode(tx, 'DE');

    let user;
    if (existingUser) {
      // Upgrade existing customer user to dealer
      const [updatedUser] = await tx`
        update users
        set email = ${cleanEmail},
            phone = ${normPhone.nationalNumber},
            full_name = coalesce(${cleanPerson}, full_name),
            role = 'dealer',
            status = 'pending',
            email_verified = true,
            phone_verified = true
        where id = ${existingUser.id}
        returning *`;
      user = updatedUser;
    } else {
      // Insert new user record
      const [newUser] = await tx`
        insert into users (email, phone, full_name, role, status, email_verified, phone_verified)
        values (${cleanEmail}, ${normPhone.nationalNumber}, ${cleanPerson}, 'dealer', 'pending', true, true)
        returning *`;
      user = newUser;
    }

    // Insert dealer application
    const [dealer] = await tx`
      insert into dealers (owner_user_id, business_name, gst_number, gst_treatment, address, city, state, pincode, status, dealer_code)
      values (${user.id}, ${cleanBusinessName}, ${gst_number ? String(gst_number).trim().toUpperCase() : null}, ${gst_treatment ? String(gst_treatment).trim() : null}, ${address ? String(address).trim() : null}, ${cleanCity}, ${cleanState}, ${cleanPin}, 'pending', ${dealerCode})
      returning *`;

    // Link dealer_id to user
    await tx`update users set dealer_id = ${dealer.id} where id = ${user.id}`;
    user.dealer_id = dealer.id;

    await audit(user.id, 'dealer.registered', 'dealer', dealer.id, {
      businessName: cleanBusinessName,
      gstNumber: gst_number,
      dealerCode,
    });

    createdUser = user;
    createdDealer = dealer;
  });

  // 2. EXTERNAL ZOHO CRM CALLS (STRICTLY POST-COMMIT)
  try {
    await provisionDealerInCrm({
      dealerId: createdDealer.id,
      dealerCode: createdDealer.dealer_code,
      user: createdUser,
      businessName: createdDealer.business_name,
      gstNumber: createdDealer.gst_number,
      gstTreatment: createdDealer.gst_treatment,
      address: createdDealer.address,
      city: cleanCity || createdDealer.city || null,
      state: cleanState || createdDealer.state || null,
      pin: cleanPin || createdDealer.pincode || null,
      pincode: cleanPin || createdDealer.pincode || null,
      personName: cleanPerson,
      firstName: cleanFirst,
      lastName: cleanLast,
      phone: normPhone.nationalNumber,
    });
  } catch (crmErr) {
    // Non-fatal: logged and audited inside provisionDealerInCrm.
    // Application remains safe and pending with zoho_account_id = null; crmPoll will retry.
    log.warn(`[dealerApp:finalize] CRM provisioning failed for dealer ${createdDealer.id}: ${crmErr.message}`);
  }

  return { user: createdUser, dealer: createdDealer };
}

/**
 * One CRM Account → backend sync step. Shared by the approval webhook and the
 * 5-minute fallback poll: CRM is re-fetched as the source of truth before this runs.
 * Returns true when the dealer row changed.
 */
export async function applyCrmAccountState(dealer, account) {
  if (!dealer || !dealer.id) return false;

  // Ensure dealer has full record if missing fields like owner_user_id
  if (!dealer.owner_user_id) {
    const full = (await sql`select * from dealers where id = ${dealer.id}`)[0];
    if (full) {
      dealer = { ...full, ...dealer };
    }
  }

  const statusMap = { Approved: 'approved', Rejected: 'rejected', Revoked: 'revoked', Pending: 'pending' };
  const newStatus = statusMap[account.dealerStatus] || (account.dealerStatus ? String(account.dealerStatus).toLowerCase() : 'pending');

  const targetPriceList = account.priceList || account.priceTier || null;

  // Ensure Zoho Commerce contact has the appropriate dealer pricebook attached
  if (account.zohoAccountId) {
    ensureContactPricebookForCrmAccount(account.zohoAccountId, targetPriceList).catch(() => {});
  }

  const cleanBusinessName = account.businessName ? String(account.businessName).trim() : null;
  const cleanGst = account.gstNumber ? String(account.gstNumber).trim().toUpperCase() : null;
  const cleanGstTreatment = account.gstTreatment ? String(account.gstTreatment).trim() : null;
  const cleanAddress = account.address ? String(account.address).trim() : null;
  const cleanCity = account.city ? String(account.city).trim() : null;
  const cleanState = account.state ? String(account.state).trim() : null;
  const cleanPincode = account.pincode ? String(account.pincode).trim() : null;

  const hasNameChange = Boolean(cleanBusinessName && cleanBusinessName !== (dealer.business_name ?? null));
  const hasGstChange = Boolean(cleanGst && cleanGst !== (dealer.gst_number ?? null));
  const hasTreatmentChange = Boolean(cleanGstTreatment && cleanGstTreatment !== (dealer.gst_treatment ?? null));
  const hasAddressChange = Boolean(cleanAddress && cleanAddress !== (dealer.address ?? null));
  const hasStatusChange = newStatus !== dealer.status;
  const hasCodeChange = Boolean(account.dealerCode && account.dealerCode !== (dealer.dealer_code ?? null));
  const hasTierChange = Boolean(targetPriceList && targetPriceList !== (dealer.price_tier ?? null));

  if (
    !hasNameChange &&
    !hasGstChange &&
    !hasTreatmentChange &&
    !hasAddressChange &&
    !hasStatusChange &&
    !hasCodeChange &&
    !hasTierChange
  ) {
    return false; // already converged
  }

  let effectiveCode = account.dealerCode || dealer.dealer_code || null;
  if (!effectiveCode && newStatus === 'approved') {
    effectiveCode = await generateUniqueDealerCode(sql, 'DE');
  }

  const ownerUserId = dealer.owner_user_id || null;
  const approvedAtVal = newStatus === 'approved' ? (dealer.approved_at || new Date().toISOString()) : null;
  const rejectReasonVal = newStatus === 'rejected' ? (account.rejectReason || 'Rejected by owner in CRM') : null;
  const zohoAccountIdVal = account.zohoAccountId || dealer.zoho_account_id || null;

  await sql`
    update dealers set
      business_name = coalesce(${cleanBusinessName}, business_name),
      gst_number = coalesce(${cleanGst}, gst_number),
      gst_treatment = coalesce(${cleanGstTreatment}, gst_treatment),
      address = coalesce(${cleanAddress}, address),
      city = coalesce(${cleanCity}, city),
      state = coalesce(${cleanState}, state),
      pincode = coalesce(${cleanPincode}, pincode),
      status = ${newStatus},
      dealer_code = coalesce(${effectiveCode}, dealer_code),
      price_tier = coalesce(${targetPriceList}, price_tier),
      zoho_account_id = coalesce(${zohoAccountIdVal}, zoho_account_id),
      reject_reason = ${rejectReasonVal},
      approved_at = ${approvedAtVal}
    where id = ${dealer.id}`;

  // Mirror the decision onto the owner user + kill their sessions on bad news
  if (ownerUserId) {
    if (newStatus === 'approved') {
      await sql`update users set status = 'active' where id = ${ownerUserId}`;
    } else if (newStatus === 'rejected' || newStatus === 'revoked') {
      await sql`update users set status = ${newStatus} where id = ${ownerUserId}`;
      await sql`update refresh_tokens set revoked = true where user_id = ${ownerUserId}`;
    }
  }

  // Also sync primary contact info (name, phone, email) if available
  if (ownerUserId) {
    try {
      const ownerContact = await crm.getPrimaryContactForAccount(zohoAccountIdVal);
      if (ownerContact) {
        const conName = ownerContact.fullName || [ownerContact.firstName, ownerContact.lastName].filter(Boolean).join(' ') || null;
        if (conName) {
          await sql`update users set full_name = ${conName} where id = ${ownerUserId}`;
        }
        if (ownerContact.email) {
          await sql`update users set email = coalesce(${ownerContact.email || null}, email) where id = ${ownerUserId}`;
        }
        if (ownerContact.phone) {
          const norm = normalizePhone(ownerContact.phone);
          if (norm.nationalNumber) {
            await sql`update users set phone = ${'+91' + norm.nationalNumber} where id = ${ownerUserId}`;
          }
        }
      }
    } catch (cErr) {
      log.warn(`[dealerApp:applyCrmAccountState] primary contact sync skipped: ${cErr.message}`);
    }
  }

  if (ownerUserId) {
    await audit(ownerUserId, `dealer.${newStatus}`, 'dealer', dealer.id, {
      via: 'crm', zohoAccountId: zohoAccountIdVal, businessName: cleanBusinessName, gstNumber: cleanGst,
    });
  }
  return true;
}

/**
 * Apply CRM Contact updates (name, phone, email) onto the corresponding backend user.
 */
export async function applyCrmContactState(contact) {
  if (!contact?.zohoContactId) return false;
  const conName = contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
  const conPhone = contact.phone ? normalizePhone(contact.phone) : null;
  const cleanPhone = conPhone?.nationalNumber ? `+91${conPhone.nationalNumber}` : null;
  const cleanEmail = contact.email ? normalizeEmail(contact.email) : null;

  const rows = await sql`
    select id, full_name, phone, email, status, role
    from users
    where zoho_contact_id = ${contact.zohoContactId}
    limit 1`;
  const user = rows[0];
  if (!user) return false;

  await sql`
    update users set
      full_name = coalesce(${conName}, full_name),
      phone = coalesce(${cleanPhone}, phone),
      email = coalesce(${cleanEmail}, email)
    where id = ${user.id}`;

  log.info(`[crm] Synced Contact ${contact.zohoContactId} to user ${user.id} (${conName || user.full_name})`);
  return true;
}

/**
 * Deactivates a dealer (dealership inactive / terminated) without deleting any records.
 * Marks dealer status as 'revoked', updates Zoho CRM Account Dealer_Status to 'Revoked',
 * deactivates all staff & owner access and revokes all active session tokens.
 */
export async function deactivateDealer(dealerId, reason = 'Dealership Inactive') {
  const dealerRows = await sql`select * from dealers where id = ${dealerId}`;
  const dealer = dealerRows[0];
  if (!dealer) return false;

  // 1. Mark dealer as revoked/inactive in database
  await sql`
    update dealers
    set status = 'revoked', reject_reason = ${reason}
    where id = ${dealer.id}`;

  // 2. Mark owner user status as inactive and kill sessions
  await sql`update users set status = 'inactive' where id = ${dealer.owner_user_id}`;
  await sql`update refresh_tokens set revoked = true where user_id = ${dealer.owner_user_id}`;

  // 3. Mark all staff users under this dealer as inactive and kill sessions
  const staffMembers = await sql`select id, zoho_contact_id from users where dealer_id = ${dealer.id}`;
  for (const s of staffMembers) {
    await sql`update users set status = 'inactive' where id = ${s.id}`;
    await sql`update refresh_tokens set revoked = true where user_id = ${s.id}`;
    if (s.zoho_contact_id) {
      await crm.deactivateContactInCrm(s.zoho_contact_id, 'Inactive').catch(() => {});
    }
  }

  // 4. Update Zoho CRM Account Dealer_Status to 'Revoked' (no deletion)
  if (dealer.zoho_account_id) {
    await crm.deactivateAccountInCrm(dealer.zoho_account_id, 'Revoked').catch(() => {});
  }

  // 5. Update owner Contact in Zoho CRM to 'Inactive' (no deletion)
  const ownerRows = await sql`select zoho_contact_id from users where id = ${dealer.owner_user_id}`;
  if (ownerRows[0]?.zoho_contact_id) {
    await crm.deactivateContactInCrm(ownerRows[0].zoho_contact_id, 'Inactive').catch(() => {});
  }

  // 6. Revoke pending invites
  await sql`update staff_invites set revoked = true where dealer_id = ${dealer.id}`;

  await audit(dealer.owner_user_id, 'dealer.deactivated', 'dealer', dealer.id, { reason });
  log.info(`[dealerApp] Deactivated dealer ${dealer.id} and updated Zoho CRM status to Revoked/Inactive (no deletion)`);
  return true;
}

export { deactivateDealer as deleteDealer };


