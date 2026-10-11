import { Router } from 'express';
import { sql } from '../db/pool.js';
import { jwtAuth, requireApprovedDealer } from '../middleware/auth.js';
import { httpError } from '../middleware/errorHandler.js';
import { applyDealer } from '../services/dealerApp.js';
import { createInvite, approveStaff, revokeStaff, holdStaff, resumeStaff, deleteStaff } from '../services/staff.js';
import { updateDealerCodeInCrm } from '../services/crmClient.js';

export const dealersRouter = Router();

dealersRouter.use(jwtAuth);

/* POST /api/dealers/apply — submit the GST + business application. */
dealersRouter.post('/apply', async (req, res, next) => {
  try {
    const { business_name, gst_number, address, person_name, phone } = req.body || {};
    if (!business_name) throw httpError(400, 'business_name is required');
    const existing = await sql`select role, status from users where id = ${req.user.id}`;
    if (existing[0]?.role === 'dealer') throw httpError(409, 'dealer application already exists');

    const dealerId = await applyDealer({
      user: req.user,
      businessName: String(business_name).trim(),
      gstNumber: gst_number ? String(gst_number).trim() : null,
      address: address ? String(address).trim() : null,
      personName: person_name ? String(person_name).trim() : null,
      phone: phone ? String(phone).trim() : (req.user.phone || null),
    });
    res.status(201).json({ ok: true, dealer_id: dealerId, status: 'pending' });
  } catch (err) { next(err); }
});

/* GET /api/dealers/me — the application's live status (pairs with /api/auth/me). */
dealersRouter.get('/me', async (req, res, next) => {
  try {
    const rows = await sql`select * from dealers where owner_user_id = ${req.user.id}`;
    const dealer = rows[0];
    if (!dealer) return res.json({ dealer: null });
    res.json({ dealer: { ...dealer, gst_number: undefined } }); // gst never echoes back
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
      select id, full_name, email, phone, status, created_at, zoho_contact_id from users
      where dealer_id = ${req.dealer.id} and role = 'dealer_staff'
      order by
        case when status = 'pending' then 1
             when status = 'active' then 2
             when status = 'hold' then 3
             else 4 end asc,
        created_at desc`;
    res.json({ staff });
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

dealersRouter.post('/staff/:userId/delete', requireApprovedDealer, async (req, res, next) => {
  try {
    await deleteStaff(req.dealer, req.params.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

/* POST /api/dealers/code — assign or update official Dealer / Store Code and sync to Zoho CRM */
dealersRouter.post('/code', requireApprovedDealer, async (req, res, next) => {
  try {
    let { code } = req.body || {};
    if (!code) {
      const num = Math.floor(1000 + Math.random() * 9000);
      code = `DLR-${num}`;
    }
    const cleanCode = String(code).trim().toUpperCase();
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


