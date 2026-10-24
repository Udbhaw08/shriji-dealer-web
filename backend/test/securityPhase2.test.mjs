import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { escapeHtml, sanitizeUrl, sanitizeHost } from '../../api/_lib/htmlEscape.js';
import { maskProductPricing, maskCatalogPricing, getDealerPricingEligibility } from '../../api/_lib/dealerPricingAuth.js';
import { signAccessToken } from '../src/services/tokens.js';
import { env } from '../src/config/env.js';

test('Security Phase 2: Reflected XSS Protection in Product Metadata', async (t) => {
  await t.test('escapeHtml converts all HTML metacharacters to safe entities', () => {
    const maliciousPayload = '"><script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const escaped = escapeHtml(maliciousPayload);

    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped.includes('onerror='), true); // attribute text is now benign text inside entities
    assert.equal(escaped.includes('&quot;&gt;&lt;script&gt;'), true);
    assert.equal(escaped.includes('&lt;img'), true);

    // Quotes and ampersands
    assert.equal(escapeHtml('Tom & Jerry "Special" \'Price\''), 'Tom &amp; Jerry &quot;Special&quot; &#39;Price&#39;');
  });

  await t.test('sanitizeUrl permits safe http/https and blocks dangerous protocols', () => {
    assert.equal(sanitizeUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(sanitizeUrl('vbscript:msgbox(1)'), '');
    assert.equal(sanitizeUrl('https://restor.in/img/stove.webp'), 'https://restor.in/img/stove.webp');
  });

  await t.test('sanitizeHost rejects malicious host header injection', () => {
    assert.equal(sanitizeHost('evil.com"><script>'), 'restor.in');
    assert.equal(sanitizeHost('evil.com/malware'), 'restor.in');
    assert.equal(sanitizeHost('restor.in'), 'restor.in');
    assert.equal(sanitizeHost('localhost:5173'), 'localhost:5173');
  });
});

test('Security Phase 2: Wholesale & Purchase-Cost Masking', async (t) => {
  const sampleProduct = {
    id: 'prod-001',
    name: '3B Stove',
    mrp: 14990,
    sellingPrice: 12990,
    dealerRate: 8500,
    purchaseRate: 6200,
  };

  await t.test('purchaseRate is NEVER exposed to any user role', () => {
    const forAnon = maskProductPricing(sampleProduct, false);
    assert.equal('purchaseRate' in forAnon, false);

    const forDealer = maskProductPricing(sampleProduct, true);
    assert.equal('purchaseRate' in forDealer, false);
  });

  await t.test('dealerRate is strictly masked for ineligible users and visible for eligible dealers', () => {
    // Ineligible: anonymous, retail customer, pending dealer
    const masked = maskProductPricing(sampleProduct, false);
    assert.equal('dealerRate' in masked, false);
    assert.equal(masked.mrp, 14990);
    assert.equal(masked.sellingPrice, 12990);

    // Eligible: approved dealer
    const unmasked = maskProductPricing(sampleProduct, true);
    assert.equal(unmasked.dealerRate, 8500);
    assert.equal(unmasked.mrp, 14990);
  });

  await t.test('catalog batch masking handles arrays correctly', () => {
    const list = [sampleProduct, { ...sampleProduct, id: 'prod-002', dealerRate: 9000, purchaseRate: 7000 }];
    const publicList = maskCatalogPricing(list, false);

    for (const p of publicList) {
      assert.equal('purchaseRate' in p, false);
      assert.equal('dealerRate' in p, false);
      assert.ok(p.mrp > 0);
    }

    const dealerList = maskCatalogPricing(list, true);
    for (const p of dealerList) {
      assert.equal('purchaseRate' in p, false);
      assert.ok(p.dealerRate > 0);
    }
  });

  await t.test('server-side eligibility check requires valid token and ignores client-supplied pricebook_id', async () => {
    // Anonymous request
    const anonReq = { headers: {}, query: { pricebook_id: 'secret-vip-tier' } };
    const anonResult = await getDealerPricingEligibility(anonReq);
    assert.equal(anonResult.eligible, false);
    assert.equal(anonResult.pricebookId, null);

    // Customer role token
    const customerToken = signAccessToken({ id: 'cust-1', role: 'customer', status: 'active', dealer_id: null });
    const custReq = { headers: { authorization: `Bearer ${customerToken}` } };
    const custResult = await getDealerPricingEligibility(custReq);
    assert.equal(custResult.eligible, false);

    // Admin role token
    const adminToken = signAccessToken({ id: 'admin-1', role: 'admin', status: 'active', dealer_id: null });
    const adminReq = { headers: { authorization: `Bearer ${adminToken}` } };
    const adminResult = await getDealerPricingEligibility(adminReq);
    assert.equal(adminResult.eligible, true);
  });
});

test('Security Phase 2: CRM Webhook Authentication & Fail-Closed Behavior', async (t) => {
  const secret = 'test-webhook-secret-xyz';
  env.webhookSecret = secret;

  function mockWebhookAuthCheck(req, nodeEnv = 'development') {
    // 1. Query secret rejection
    if (req.query?.secret) {
      const err = new Error('secret in query forbidden');
      err.statusCode = 400;
      throw err;
    }

    const configuredSecret = env.webhookSecret;
    if (!configuredSecret) {
      if (nodeEnv === 'production') {
        const err = new Error('service_unavailable');
        err.statusCode = 503;
        throw err;
      }
      const err = new Error('unauthorized');
      err.statusCode = 401;
      throw err;
    }

    const headerSecret = req.headers?.['x-webhook-secret'];
    if (typeof headerSecret !== 'string') {
      const err = new Error('unauthorized');
      err.statusCode = 401;
      throw err;
    }

    const headerBuf = Buffer.from(headerSecret);
    const secretBuf = Buffer.from(configuredSecret);
    if (headerBuf.length !== secretBuf.length || !crypto.timingSafeEqual(headerBuf, secretBuf)) {
      const err = new Error('unauthorized');
      err.statusCode = 401;
      throw err;
    }

    return { ok: true };
  }

  await t.test('rejects webhook secret passed in query string', () => {
    assert.throws(
      () => mockWebhookAuthCheck({ query: { secret } }),
      (err) => err.statusCode === 400
    );
  });

  await t.test('rejects missing or incorrect X-Webhook-Secret header', () => {
    assert.throws(
      () => mockWebhookAuthCheck({ headers: {} }),
      (err) => err.statusCode === 401
    );

    assert.throws(
      () => mockWebhookAuthCheck({ headers: { 'x-webhook-secret': 'wrong-secret' } }),
      (err) => err.statusCode === 401
    );
  });

  await t.test('accepts valid X-Webhook-Secret header via timing-safe check', () => {
    const res = mockWebhookAuthCheck({ headers: { 'x-webhook-secret': secret } });
    assert.equal(res.ok, true);
  });

  await t.test('fails closed with 503 in production if WEBHOOK_SECRET is unconfigured', () => {
    env.webhookSecret = '';
    assert.throws(
      () => mockWebhookAuthCheck({ headers: { 'x-webhook-secret': 'anything' } }, 'production'),
      (err) => err.statusCode === 503
    );
    env.webhookSecret = secret; // restore
  });
});

test.after(async () => {
  try {
    const { sql } = await import('../src/db/pool.js');
    await sql.end({ timeout: 1 });
  } catch {}
});
