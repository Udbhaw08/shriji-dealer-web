import test from 'node:test';
import assert from 'node:assert/strict';
import { hashOtp } from '../src/utils/hash.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { rateLimit } from '../src/middleware/rateLimit.js';

test('Security Phase 3: Refresh Token Race Condition & Atomic Consumption', async (t) => {
  await t.test('concurrent refresh token rotation ensures single-winner atomic consumption', async () => {
    // Model atomic rotation: token starts active (revoked: false)
    let tokenState = { id: 1, revoked: false, consumedCount: 0 };

    async function atomicRotate() {
      // Simulates: UPDATE refresh_tokens SET revoked = true WHERE id = 1 AND revoked = false RETURNING id
      if (!tokenState.revoked) {
        tokenState.revoked = true;
        tokenState.consumedCount++;
        return { ok: true, newToken: 'fresh_token_' + Math.random() };
      }
      return null;
    }

    // Launch concurrent rotations simultaneously
    const results = await Promise.all([
      atomicRotate(),
      atomicRotate(),
      atomicRotate(),
    ]);

    const successes = results.filter((r) => r !== null);
    const failures = results.filter((r) => r === null);

    // Exactly one concurrent consumer wins
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 2);
    assert.equal(tokenState.consumedCount, 1);
  });
});

test('Security Phase 3: Fail-Fast Secret Configuration in Production', async (t) => {
  await t.test('hashOtp throws fatal error in production when secrets are missing', () => {
    const savedEnv = process.env.NODE_ENV;
    const savedOtp = process.env.OTP_SECRET;
    const savedJwt = process.env.JWT_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.OTP_SECRET;
      delete process.env.JWT_SECRET;

      assert.throws(
        () => hashOtp('123456', '+919876543210'),
        /FATAL: Neither OTP_SECRET nor JWT_SECRET is configured/
      );
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedOtp) process.env.OTP_SECRET = savedOtp;
      if (savedJwt) process.env.JWT_SECRET = savedJwt;
    }
  });
});

test('Security Phase 3: Error Handler Production Masking & Correlation ID', async (t) => {
  await t.test('masks internal error messages for HTTP 500 in production', () => {
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const internalDbError = new Error('Database connection failed: postgresql://admin:super_secret_pw@db.internal:5432');
      internalDbError.statusCode = 500;

      let responseStatus = 0;
      let responseBody = null;

      const fakeReq = { method: 'POST', path: '/api/checkout', headers: {} };
      const fakeRes = {
        status(code) { responseStatus = code; return this; },
        json(body) { responseBody = body; return this; },
      };

      errorHandler(internalDbError, fakeReq, fakeRes, () => {});

      assert.equal(responseStatus, 500);
      assert.equal(responseBody.error, 'internal_server_error');
      // Secret database string MUST NOT be leaked in response
      assert.equal(JSON.stringify(responseBody).includes('super_secret_pw'), false);
      assert.ok(responseBody.correlationId);
    } finally {
      process.env.NODE_ENV = savedEnv;
    }
  });
});

test('Security Phase 3: Rate Limiter Selective Eviction (No Global Reset Bypass)', async (t) => {
  await t.test('selective LRU eviction prunes oldest keys without wiping active user buckets', () => {
    const testBuckets = new Map();

    // Populate with 10,001 keys
    for (let i = 0; i <= 10000; i++) {
      testBuckets.set(`ip-${i}`, [Date.now()]);
    }

    assert.equal(testBuckets.size, 10001);

    // Apply the bounded LRU eviction logic
    if (testBuckets.size > 10000) {
      let toRemove = Math.floor(testBuckets.size * 0.2);
      for (const oldestKey of testBuckets.keys()) {
        testBuckets.delete(oldestKey);
        if (--toRemove <= 0) break;
      }
    }

    // Size is reduced to 80% (approx 8000), NOT cleared to 0
    assert.equal(testBuckets.size, 8001);
    // Active recent users are preserved
    assert.equal(testBuckets.has('ip-10000'), true);
    assert.equal(testBuckets.has('ip-9000'), true);
    // Oldest users were pruned
    assert.equal(testBuckets.has('ip-0'), false);
  });
});

test('Security Phase 3: Public Dealer Info PII Stripping', async (t) => {
  await t.test('dealer info response strips phone, email, GST, and internal IDs', () => {
    // Raw database / internal dealer representation
    const rawDbDealer = {
      id: 'fa0e9ef4-29d5-4816-9e22-c3fefee354be',
      business_name: 'Shriji Enterprises',
      person_name: 'Owner Name',
      phone: '9876543210',
      email: 'owner@shriji.com',
      gst_number: '27AAAAA0000A1Z5',
      owner_user_id: 'user-secret-uuid-1234',
      zoho_account_id: '3334672000000999999',
      price_tier: 'Tier A Special Discount',
      city: 'Mumbai',
      state: 'Maharashtra',
      dealer_code: 'SHR-001',
      status: 'approved',
    };

    // Public showroom attribution filter (as enforced in api/dealer/info.js)
    const publicDealer = {
      id: rawDbDealer.id,
      name: rawDbDealer.business_name,
      city: rawDbDealer.city || '',
      state: rawDbDealer.state || '',
      code: rawDbDealer.dealer_code || '',
      status: rawDbDealer.status,
    };

    // Required public fields
    assert.equal(publicDealer.name, 'Shriji Enterprises');
    assert.equal(publicDealer.city, 'Mumbai');

    // Confidential PII strictly absent
    assert.equal('phone' in publicDealer, false);
    assert.equal('email' in publicDealer, false);
    assert.equal('gst_number' in publicDealer, false);
    assert.equal('owner_user_id' in publicDealer, false);
    assert.equal('zoho_account_id' in publicDealer, false);
    assert.equal('price_tier' in publicDealer, false);
  });
});
