import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { signAdminToken, verifyAccessToken } from '../src/services/tokens.js';
import { verifyAdminAuth } from '../../api/_lib/adminAuth.js';
import { getDealerPricingEligibility, maskCatalogPricing, maskProductPricing } from '../../api/_lib/dealerPricingAuth.js';
import { adminRouter } from '../src/routes/admin.js';
import { uploadsRouter } from '../src/routes/uploads.js';
import { uploadRouter } from '../src/routes/upload.js';
import { contentRouter } from '../src/routes/content.js';
import { sql } from '../src/db/pool.js';

test.after(async () => {
  try {
    await sql.end({ timeout: 1 });
  } catch {}
});

/* ==========================================================================
 * 1. Admin Authentication & Session Token Tests
 * ========================================================================== */
test('Admin Authentication: Secure Flow, Expiry & Fail-Closed Behavior', async (t) => {
  const origKey = process.env.ADMIN_API_KEY;
  const testKey = 'super-secret-admin-key-123456';
  process.env.ADMIN_API_KEY = testKey;

  t.after(() => {
    process.env.ADMIN_API_KEY = origKey;
  });

  await t.test('POST /api/admin/login rejects missing or incorrect admin key', async () => {
    let resStatus = 0;
    let resData = null;
    const req1 = { body: {} };
    const res1 = {
      status(s) { resStatus = s; return this; },
      json(d) { resData = d; return this; },
    };
    const loginHandler = adminRouter.stack.find((s) => s.route?.path === '/login').route.stack.slice(-1)[0].handle;
    await loginHandler(req1, res1);
    assert.equal(resStatus, 401);
    assert.equal(resData.ok, false);

    const req2 = { body: { adminKey: 'wrong-key-value' } };
    await loginHandler(req2, res1);
    assert.equal(resStatus, 401);
    assert.equal(resData.ok, false);
  });

  await t.test('POST /api/admin/login fails closed with 503 if ADMIN_API_KEY is unconfigured or too short', async () => {
    delete process.env.ADMIN_API_KEY;
    let resStatus = 0;
    let resData = null;
    const req = { body: { adminKey: 'something' } };
    const res = {
      status(s) { resStatus = s; return this; },
      json(d) { resData = d; return this; },
    };
    const loginHandler = adminRouter.stack.find((s) => s.route?.path === '/login').route.stack.slice(-1)[0].handle;
    await loginHandler(req, res);
    assert.equal(resStatus, 503);
    assert.equal(resData.error, 'admin_auth_not_configured');
    process.env.ADMIN_API_KEY = testKey;
  });

  await t.test('POST /api/admin/login issues a short-lived admin session token on valid key', async () => {
    let resStatus = 200;
    let resData = null;
    const req = { body: { adminKey: testKey } };
    const res = {
      status(s) { resStatus = s; return this; },
      json(d) { resData = d; return this; },
    };
    const loginHandler = adminRouter.stack.find((s) => s.route?.path === '/login').route.stack.slice(-1)[0].handle;
    await loginHandler(req, res);
    assert.equal(resStatus, 200);
    assert.equal(resData.ok, true);
    assert.ok(resData.token);
    assert.equal(resData.expiresIn, 3600);

    const claims = verifyAccessToken(resData.token);
    assert.equal(claims.role, 'admin');
    assert.equal(claims.purpose, 'admin_session');
    assert.equal(claims.sub, 'admin');
  });

  await t.test('verifyAdminAuth validates short-lived admin session token', async () => {
    const adminToken = signAdminToken({ expiresIn: 60 });
    const authResult = await verifyAdminAuth({
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(authResult.ok, true);
    assert.equal(authResult.admin, true);
    assert.equal(authResult.method, 'jwt');
  });

  await t.test('verifyAdminAuth rejects expired, tampered, or non-admin token', async () => {
    const expiredToken = jwt.sign(
      { sub: 'admin', role: 'admin', purpose: 'admin_session' },
      env.jwtSecret,
      { expiresIn: -10 }
    );
    const expiredResult = await verifyAdminAuth({
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expiredResult.ok, false);

    const tamperedResult = await verifyAdminAuth({
      headers: { authorization: `Bearer ${expiredToken}junk` },
    });
    assert.equal(tamperedResult.ok, false);

    const customerToken = jwt.sign(
      { sub: 'cust-123', role: 'customer' },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const customerResult = await verifyAdminAuth({
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert.equal(customerResult.ok, false);
  });

  await t.test('verifyAdminAuth rejects anonymous requests', async () => {
    const anonResult = await verifyAdminAuth({ headers: {} });
    assert.equal(anonResult.ok, false);
    assert.equal(anonResult.error, 'admin_auth_required');
  });

  await t.test('Verifies ADMIN_API_KEY is not leaked into source code or build configuration', () => {
    const rootDir = process.cwd().endsWith('backend') ? path.resolve(process.cwd(), '..') : process.cwd();
    const viteConfig = fs.readFileSync(path.resolve(rootDir, 'vite.config.js'), 'utf8');
    assert.equal(viteConfig.includes(testKey), false);
    assert.equal(viteConfig.includes('VITE_ADMIN_API_KEY'), false);

    const adminUi = fs.readFileSync(path.resolve(rootDir, 'src/pages/ContentAdminDashboard.jsx'), 'utf8');
    assert.equal(adminUi.includes(testKey), false);
    assert.equal(adminUi.includes('localStorage.setItem("admin'), false);
    assert.equal(adminUi.includes('sessionStorage.setItem("admin'), false);
  });
});

/* ==========================================================================
 * 2. Staff Pricing Authorization & Database Role Parity Tests
 * ========================================================================== */
test('Pricing Authorization: dealer_staff Role, Permission Gating & Zero-Leakage', async (t) => {
  const sampleProducts = [
    {
      id: 'p1',
      name: 'Smart Auto Clean Chimney',
      rate: 18990,
      dealerRate: 12490,
      purchaseRate: 9800,
    },
    {
      id: 'p2',
      name: 'Luxury 4-Burner Hob',
      rate: 15490,
      dealerRate: 10200,
      purchaseRate: 8100,
    },
  ];

  await t.test('Anonymous visitor receives MRP only; purchaseRate and dealerRate are masked', async () => {
    const eligibility = await getDealerPricingEligibility({ headers: {} });
    assert.equal(eligibility.eligible, false);

    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].purchaseRate, undefined);
    assert.equal(catalog[0].dealerRate, undefined);
    assert.equal(catalog[0].rate, 18990);

    const single = maskProductPricing(sampleProducts[0], eligibility.eligible);
    assert.equal(single.purchaseRate, undefined);
    assert.equal(single.dealerRate, undefined);
    assert.equal(single.rate, 18990);
  });

  await t.test('Retail customer receives MRP only; dealerRate is masked', async () => {
    const custToken = jwt.sign(
      { sub: 'user-cust-1', role: 'customer', status: 'active' },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const eligibility = await getDealerPricingEligibility({
      headers: { authorization: `Bearer ${custToken}` },
    });
    assert.equal(eligibility.eligible, false);
    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].dealerRate, undefined);
    assert.equal(catalog[0].purchaseRate, undefined);
  });

  await t.test('Pending or unapproved dealer receives MRP only; dealerRate is masked', async () => {
    const pendingToken = jwt.sign(
      { sub: 'user-dealer-pending', role: 'dealer', status: 'pending' },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const eligibility = await getDealerPricingEligibility({
      headers: { authorization: `Bearer ${pendingToken}` },
    });
    assert.equal(eligibility.eligible, false);
    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].dealerRate, undefined);
    assert.equal(catalog[0].purchaseRate, undefined);
  });

  await t.test('Approved dealer receives dealerRate; purchaseRate remains masked', async () => {
    const approvedToken = jwt.sign(
      { sub: 'user-dealer-approved', role: 'dealer', status: 'active', price_tier: 'tier-platinum' },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const eligibility = await getDealerPricingEligibility({
      headers: { authorization: `Bearer ${approvedToken}` },
    });
    assert.equal(eligibility.eligible, true);
    assert.ok(eligibility.pricebookId);

    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].dealerRate, 12490);
    assert.equal(catalog[0].purchaseRate, undefined); // Zero-leakage invariant
  });

  await t.test('dealer_staff with can_see_dealer_price: true receives dealerRate', async () => {
    const staffToken = jwt.sign(
      {
        sub: 'user-staff-1',
        role: 'dealer_staff',
        status: 'active',
        can_see_dealer_price: true,
        hide_staff_dealer_price: false,
      },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const eligibility = await getDealerPricingEligibility({
      headers: { authorization: `Bearer ${staffToken}` },
    });
    assert.equal(eligibility.eligible, true);

    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].dealerRate, 12490);
    assert.equal(catalog[0].purchaseRate, undefined);
  });

  await t.test('dealer_staff with can_see_dealer_price: false has dealerRate masked', async () => {
    const staffNoPriceToken = jwt.sign(
      {
        sub: 'user-staff-disabled',
        role: 'dealer_staff',
        status: 'active',
        can_see_dealer_price: false,
        hide_staff_dealer_price: false,
      },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const eligibility = await getDealerPricingEligibility({
      headers: { authorization: `Bearer ${staffNoPriceToken}` },
    });
    assert.equal(eligibility.eligible, false);

    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].dealerRate, undefined);
    assert.equal(catalog[0].purchaseRate, undefined);
  });

  await t.test('dealer_staff when dealer has hide_staff_dealer_price: true has dealerRate masked', async () => {
    const staffDealerHiddenToken = jwt.sign(
      {
        sub: 'user-staff-hidden',
        role: 'dealer_staff',
        status: 'active',
        can_see_dealer_price: true,
        hide_staff_dealer_price: true,
      },
      env.jwtSecret,
      { expiresIn: 3600 }
    );
    const eligibility = await getDealerPricingEligibility({
      headers: { authorization: `Bearer ${staffDealerHiddenToken}` },
    });
    assert.equal(eligibility.eligible, false);

    const catalog = maskCatalogPricing(sampleProducts, eligibility.eligible);
    assert.equal(catalog[0].dealerRate, undefined);
    assert.equal(catalog[0].purchaseRate, undefined);
  });
});

/* ==========================================================================
 * 3. Upload-Folder Compatibility & Strict Containment Tests
 * ========================================================================== */
test('Upload Folder Compatibility & Directory Traversal Resistance', async (t) => {
  const allowedFolders = [
    'hero-banners',
    'banners',
    'schemes',
    'branding',
    'circulars',
    'webstore-assets',
    'products',
  ];

  const app = express();
  app.use(uploadsRouter);

  let server;
  let baseUrl;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('accepts all genuinely used application and legacy asset folders', async () => {
    for (const folder of allowedFolders) {
      const res = await fetch(`${baseUrl}/${folder}/nonexistent-test-file.jpg`);
      // A non-existent file in an ALLOWED folder must return 404 (File not found), NOT 403 (Access denied / Invalid folder)
      assert.equal(res.status, 404, `Expected 404 for missing file in allowed folder ${folder}, got ${res.status}`);
    }
  });

  await t.test('rejects arbitrary, unauthorized folders with 403', async () => {
    const disallowedFolders = ['etc', 'node_modules', 'src', 'config', 'secrets', 'private'];
    for (const folder of disallowedFolders) {
      const res = await fetch(`${baseUrl}/${folder}/test.jpg`);
      assert.equal(res.status, 403, `Expected 403 for disallowed folder ${folder}`);
    }
  });

  await t.test('rejects directory traversal in folder or filename with 403', async () => {
    const traversalTests = [
      '/?path=hero-banners/../package.json',
      '/?path=../../backend/.env',
      '/?path=hero-banners/test%00.png',
    ];

    for (const p of traversalTests) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 403, `Expected 403 for traversal path: ${p}`);
    }
  });
});

/* ==========================================================================
 * 4. Guest Dealer Registration Compatibility Test
 * ========================================================================== */
test('Guest Dealer Registration: Finalization Without Existing Session', async (t) => {
  await t.test('finalizeDealerRegistration validates session flowId and single-use verification token', async () => {
    const { finalizeDealerRegistration } = await import('../src/services/dealerApp.js');
    
    // 1. Missing flowId
    await assert.rejects(
      async () => finalizeDealerRegistration({
        business_name: 'Test Business',
        phone: '9876543210',
        email: 'test@example.com',
      }),
      /Registration session ID \(flowId\) is required/
    );

    // 2. Non-existent flow throws invalid or expired registration session
    await assert.rejects(
      async () => finalizeDealerRegistration({
        flowId: crypto.randomUUID(),
        business_name: 'Test Business',
        phone: '9876543210',
        email: 'test@example.com',
      }),
      /Invalid or expired registration session/
    );
  });
});
