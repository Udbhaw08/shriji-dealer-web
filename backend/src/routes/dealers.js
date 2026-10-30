import { Router } from 'express';
import { sql } from '../db/pool.js';
import { jwtAuth, requireApprovedDealer, optionalAuth } from '../middleware/auth.js';
import { httpError } from '../middleware/errorHandler.js';
import { rateLimit, getClientIp } from '../middleware/rateLimit.js';
import {
  applyDealer,
  applyCrmAccountState,
  deleteDealer,
  requestDealerRegistrationOtp,
  verifyDealerRegistrationOtp,
  finalizeDealerRegistration,
} from '../services/dealerApp.js';
import { issueSession } from './auth.js';
import { createInvite, approveStaff, revokeStaff, holdStaff, resumeStaff, deleteStaff, toggleStaffPrice, toggleAllStaffPrice } from '../services/staff.js';
import * as crm from '../services/crmClient.js';
const { updateDealerCodeInCrm, getDealerAccount } = crm;
import { resolvePricebookId } from '../services/commerceClient.js';
import { formatLoginCode, generateUniqueDealerCode } from '../utils/loginCode.js';
import { isValidName, cleanName, isValidGstin, isValidPhone } from '../utils/validators.js';
import { env } from '../config/env.js';

export const dealersRouter = Router();

const strictLimit = rateLimit({
  windowMs: 60_000,
  max: () => env.authStrictRateLimitMax || 120,
  prefix: 'dealer_strict',
  keyFn: (req) => {
    const target = req.body?.phone || req.body?.email || req.body?.flowId || req.body?.flow_id;
    if (target) return `target:${String(target).trim().toLowerCase()}`;
    return `ip:${getClientIp(req)}`;
  },
  message: 'Too many verification attempts. Please wait a moment before trying again.',
});
const otpRequestLimit = rateLimit({
  windowMs: () => env.otpRateLimitWindowMs || (3 * 60_000),
  max: () => env.otpRateLimitMax || 20,
  prefix: 'dealer_reg_otp',
  keyFn: (req) => {
    const raw = req.body?.phone || req.body?.email;
    if (raw) return `target:${String(raw).trim().toLowerCase()}`;
    return `ip:${getClientIp(req)}`;
  },
  message: 'Too many registration verification attempts. Please wait a moment before trying again.',
});

/* ==========================================================================
 * Public Dealer Registration (Guest Form-First, Verify-Both-Channels)
 * No permanent user/dealer rows or CRM calls occur until both channels verify
 * and registration is atomically finalized.
 * ========================================================================== */

/* POST /api/dealers/register/phone/request-otp */
dealersRouter.post('/register/phone/request-otp', optionalAuth, otpRequestLimit, async (req, res, next) => {
  try {
    const result = await requestDealerRegistrationOtp({
      flowId: req.body?.flowId || req.body?.flow_id,
      channel: 'phone',
      phone: req.body?.phone || req.user?.phone,
      email: req.body?.email || req.body?.official_email || req.user?.email,
      user: req.user,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* POST /api/dealers/register/phone/verify-otp */
dealersRouter.post('/register/phone/verify-otp', optionalAuth, strictLimit, async (req, res, next) => {
  try {
    const result = await verifyDealerRegistrationOtp({
      flowId: req.body?.flowId || req.body?.flow_id,
      channel: 'phone',
      phone: req.body?.phone || req.user?.phone,
      email: req.body?.email || req.body?.official_email || req.user?.email,
      code: req.body?.code || req.body?.otp,
      user: req.user,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* POST /api/dealers/register/email/request-otp */
dealersRouter.post('/register/email/request-otp', optionalAuth, otpRequestLimit, async (req, res, next) => {
  try {
    const result = await requestDealerRegistrationOtp({
      flowId: req.body?.flowId || req.body?.flow_id,
      channel: 'email',
      email: req.body?.email || req.body?.official_email || req.body?.contact,
      phone: req.body?.phone || req.user?.phone,
      user: req.user,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* POST /api/dealers/register/email/verify-otp */
dealersRouter.post('/register/email/verify-otp', optionalAuth, strictLimit, async (req, res, next) => {
  try {
    const result = await verifyDealerRegistrationOtp({
      flowId: req.body?.flowId || req.body?.flow_id,
      channel: 'email',
      email: req.body?.email || req.body?.official_email || req.body?.contact,
      phone: req.body?.phone || req.user?.phone,
      code: req.body?.code || req.body?.otp,
      user: req.user,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* Unified POST /api/dealers/register/otp/request */
dealersRouter.post('/register/otp/request', optionalAuth, otpRequestLimit, async (req, res, next) => {
  try {
    const channel = req.body?.channel || (req.body?.phone ? 'phone' : 'email');
    const result = await requestDealerRegistrationOtp({
      flowId: req.body?.flowId || req.body?.flow_id,
      channel,
      phone: req.body?.phone || req.user?.phone,
      email: req.body?.email || req.body?.official_email || req.user?.email,
      user: req.user,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* Unified POST /api/dealers/register/otp/verify */
dealersRouter.post('/register/otp/verify', optionalAuth, strictLimit, async (req, res, next) => {
  try {
    const channel = req.body?.channel || (req.body?.phone ? 'phone' : 'email');
    const result = await verifyDealerRegistrationOtp({
      flowId: req.body?.flowId || req.body?.flow_id,
      channel,
      phone: req.body?.phone || req.user?.phone,
      email: req.body?.email || req.body?.official_email || req.user?.email,
      code: req.body?.code || req.body?.otp,
      user: req.user,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/* POST /api/dealers/register/finalize & POST /api/dealers/register */
async function handleDealerRegistrationFinalize(req, res, next) {
  try {
    const {
      flowId,
      flow_id,
      verificationToken,
      verification_token,
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
    } = req.body || {};

    const { user, dealer } = await finalizeDealerRegistration({
      flowId: flowId || flow_id,
      verificationToken: verificationToken || verification_token,
      business_name,
      person_name,
      first_name,
      last_name,
      phone,
      email,
      gst_treatment,
      gst_number,
      address,
      user: req.user,
    });

    const session = await issueSession(user);
    res.status(201).json({
      ok: true,
      status: 'pending',
      dealer_id: dealer.id,
      dealer_code: dealer.dealer_code,
      ...session,
    });
  } catch (err) { next(err); }
}

dealersRouter.post('/register/finalize', optionalAuth, strictLimit, handleDealerRegistrationFinalize);
dealersRouter.post('/register', optionalAuth, strictLimit, handleDealerRegistrationFinalize);

/* ==========================================================================
 * Authenticated Dealer Endpoints (Requires Valid Session)
 * ========================================================================== */
dealersRouter.use(jwtAuth);

/* POST /api/dealers/apply — submit the GST + business application. */
dealersRouter.post('/apply', async (req, res, next) => {
  try {
    const { business_name, gst_number, gst_treatment, address, person_name, first_name, last_name, phone } = req.body || {};
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
    if (!req.user.email_verified) {
      throw httpError(403, 'Email verification is required before applying for dealer access');
    }
    if (!req.user.phone_verified) {
      throw httpError(403, 'Phone verification via WhatsApp OTP is required before applying for dealer access');
    }

    const cleanPhone = req.user.phone || (phone ? String(phone).trim() : null);
    if (cleanPhone && !isValidPhone(cleanPhone)) {
      throw httpError(400, 'Please enter a valid 10-digit mobile number');
    }

    const existing = await sql`select role, status from users where id = ${req.user.id}`;
    if (existing[0]?.role === 'dealer') throw httpError(409, 'dealer application already exists');

    const cleanFirst = first_name ? cleanName(first_name) : null;
    const cleanLast = last_name ? cleanName(last_name) : null;
    const cleanPerson = person_name ? cleanName(person_name) : ([cleanFirst, cleanLast].filter(Boolean).join(' ') || null);

    const dealerId = await applyDealer({
      user: req.user,
      businessName: cleanName(business_name),
      gstNumber: gst_number ? String(gst_number).trim().toUpperCase() : null,
      gstTreatment: gst_treatment ? String(gst_treatment).trim() : null,
      address: address ? String(address).trim() : null,
      personName: cleanPerson,
      firstName: cleanFirst,
      lastName: cleanLast,
      phone: cleanPhone,
    });
    res.status(201).json({ ok: true, dealer_id: dealerId, status: 'pending' });
  } catch (err) { next(err); }
});

const lastCrmSyncByDealerId = new Map();

/* GET /api/dealers/me — the application's live status (pairs with /api/auth/me). */
dealersRouter.get('/me', async (req, res, next) => {
  try {
    const rows = await sql`select * from dealers where owner_user_id = ${req.user.id}`;
    let dealer = rows[0];
    if (!dealer) return res.json({ dealer: null });

    // 2-way sync: Refresh from CRM if linked and not checked in the last 30 seconds
    if (dealer.zoho_account_id && crm.isCrmConfigured()) {
      const lastSync = lastCrmSyncByDealerId.get(dealer.id) || 0;
      if (Date.now() - lastSync > 30_000) {
        lastCrmSyncByDealerId.set(dealer.id, Date.now());
        try {
          const account = await crm.getDealerAccount(dealer.zoho_account_id);
          if (account) {
            await applyCrmAccountState(dealer, account);
            dealer = (await sql`select * from dealers where id = ${dealer.id}`)[0];
          }
        } catch (crmErr) {
          // Non-fatal
        }
      }
    }

    const pricebookId = dealer.price_tier ? await resolvePricebookId(dealer.price_tier) : null;
    res.json({
      dealer: {
        ...dealer,
        pricebook_id: pricebookId,
        hide_staff_dealer_price: Boolean(dealer.hide_staff_dealer_price),
      },
    });
  } catch (err) { next(err); }
});

/* POST /api/dealers/sync-crm — on-demand immediate sync of dealer tier/status from Zoho CRM */
dealersRouter.post('/sync-crm', async (req, res, next) => {
  try {
    const rows = await sql`
      select * from dealers
      where id = ${req.user.dealer_id} or owner_user_id = ${req.user.id}
      limit 1`;
    const dealer = rows[0];
    if (!dealer || !dealer.zoho_account_id) {
      return res.json({ ok: false, message: 'Dealer not linked to Zoho CRM Account' });
    }
    const account = await getDealerAccount(dealer.zoho_account_id);
    if (!account) return res.json({ ok: false, message: 'CRM account not found' });
    await applyCrmAccountState(dealer, account);
    const updated = (await sql`select * from dealers where id = ${dealer.id}`)[0];
    const pricebookId = updated.status === 'approved' && updated.price_tier ? await resolvePricebookId(updated.price_tier) : null;
    res.json({ ok: true, dealer: { ...updated, pricebook_id: pricebookId } });
  } catch (err) { next(err); }
});

/* --- staff management (approved dealers only) --- */

dealersRouter.post('/staff/invite', requireApprovedDealer, async (req, res, next) => {
  try {
    const countRows = await sql`
      select count(*)::int as n from users
      where dealer_id = ${req.dealer.id} and role = 'dealer_staff' and status in ('active','pending')`;
    if (countRows[0].n >= req.dealer.staff_limit) {
      throw httpError(409, `staff limit of ${req.dealer.staff_limit} reached`);
    }
    const { code, expiresAt } = await createInvite(req.dealer);
    res.status(201).json({ code, expires_at: expiresAt });
  } catch (err) { next(err); }
});

dealersRouter.get('/staff', requireApprovedDealer, async (req, res, next) => {
  try {
    const staff = await sql`
      select id, full_name, email, phone, status, created_at, zoho_contact_id, can_see_dealer_price from users
      where dealer_id = ${req.dealer.id}
        and role = 'dealer_staff'
        and (
          status in ('active', 'hold', 'revoked')
          or exists (select 1 from refresh_tokens rt where rt.user_id = users.id)
        )
      order by
        case when status = 'pending' then 1
             when status = 'active' then 2
             when status = 'hold' then 3
             else 4 end asc,
        created_at desc`;
    res.json({ staff, hide_staff_dealer_price: Boolean(req.dealer.hide_staff_dealer_price) });
  } catch (err) { next(err); }
});

dealersRouter.post('/staff/:userId/approve', requireApprovedDealer, async (req, res, next) => {
  try {
    await approveStaff(req.dealer, req.params.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

dealersRouter.post('/staff/:userId/hold', requireApprovedDealer, async (req, res, next) => {
  try {
    await holdStaff(req.dealer, req.params.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

dealersRouter.post('/staff/:userId/resume', requireApprovedDealer, async (req, res, next) => {
  try {
    await resumeStaff(req.dealer, req.params.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

dealersRouter.post('/staff/:userId/revoke', requireApprovedDealer, async (req, res, next) => {
  try {
    await revokeStaff(req.dealer, req.params.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

dealersRouter.post('/staff/:userId/toggle-price', requireApprovedDealer, async (req, res, next) => {
  try {
    const { can_see_dealer_price } = req.body || {};
    const result = await toggleStaffPrice(req.dealer, req.params.userId, can_see_dealer_price);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

dealersRouter.post('/staff/toggle-price-all', requireApprovedDealer, async (req, res, next) => {
  try {
    const { can_see_dealer_price } = req.body || {};
    const result = await toggleAllStaffPrice(req.dealer, can_see_dealer_price);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

dealersRouter.post(['/staff/:userId/delete', '/staff/:userId/deactivate'], requireApprovedDealer, async (req, res, next) => {
  try {
    await deleteStaff(req.dealer, req.params.userId);
    res.json({ ok: true, message: 'Staff deactivated successfully (Zoho CRM contact set to Inactive)' });
  } catch (err) { next(err); }
});

/* POST /api/dealers/code — assign or update official Dealer / Store Code and sync to Zoho CRM */
dealersRouter.post('/code', requireApprovedDealer, async (req, res, next) => {
  try {
    let { code } = req.body || {};
    let cleanCode;
    if (!code || !String(code).trim()) {
      cleanCode = await generateUniqueDealerCode(sql, 'DE');
    } else {
      cleanCode = formatLoginCode(code);
    }
    if (cleanCode.length < 3) {
      throw httpError(400, 'Dealer code must be at least 3 characters');
    }

    // Check uniqueness (exclude current dealer)
    const dupe = await sql`
      select id from dealers
      where lower(dealer_code) = lower(${cleanCode}) and id != ${req.dealer.id}`;
    if (dupe.length) {
      throw httpError(409, 'This Dealer / Store Code is already in use by another dealer');
    }

    await sql`update dealers set dealer_code = ${cleanCode} where id = ${req.dealer.id}`;

    let crmSynced = false;
    if (req.dealer.zoho_account_id) {
      crmSynced = await updateDealerCodeInCrm({
        zohoAccountId: req.dealer.zoho_account_id,
        dealerCode: cleanCode,
        ownerPhone: req.user?.phone,
      });
    }

    res.json({ ok: true, dealer_code: cleanCode, crm_synced: crmSynced });
  } catch (err) { next(err); }
});

/* DELETE or POST /api/dealers/me — deactivate dealer account in DB and mark Revoked/Inactive in Zoho CRM (no deletion) */
dealersRouter.all(['/me', '/me/deactivate'], async (req, res, next) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') return next();
  try {
    const dealerRows = await sql`
      select id from dealers
      where owner_user_id = ${req.user.id} or id = ${req.user.dealer_id} limit 1`;
    if (!dealerRows[0]) throw httpError(404, 'Dealer account not found');
    await deleteDealer(dealerRows[0].id, req.body?.reason || 'Deactivated by user');
    res.json({ ok: true, message: 'Dealer deactivated successfully (Zoho records set to Revoked/Inactive)' });
  } catch (err) { next(err); }
});

/* DELETE or POST /api/dealers/:dealerId — admin/owner deactivate specific dealer */
dealersRouter.all(['/:dealerId', '/:dealerId/deactivate'], async (req, res, next) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') return next();
  try {
    if (req.user.role !== 'admin' && req.user.dealer_id !== req.params.dealerId) {
      const isOwner = (await sql`select id from dealers where id = ${req.params.dealerId} and owner_user_id = ${req.user.id}`)[0];
      if (!isOwner) throw httpError(403, 'Forbidden');
    }
    await deleteDealer(req.params.dealerId, req.body?.reason || 'Deactivated by user');
    res.json({ ok: true, message: 'Dealer deactivated successfully (Zoho records set to Revoked/Inactive)' });
  } catch (err) { next(err); }
});



