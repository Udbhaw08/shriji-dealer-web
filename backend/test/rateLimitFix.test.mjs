import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../src/middleware/rateLimit.js';

test('Rate Limit Fix: Dynamic window and retry_after_seconds bounding', async (t) => {
  await t.test('default otp rate limit allows high-volume attempts and calculates bounded retry-after', () => {
    const limiter = rateLimit({
      windowMs: 3 * 60_000, // 3 minutes = 180s max
      max: 20,
      prefix: 'test_bound_rl',
      keyFn: () => 'user-test-key-1',
    });

    const savedEnv = process.env.NODE_ENV;
    const savedTestRl = process.env.TEST_RATE_LIMIT;

    try {
      process.env.TEST_RATE_LIMIT = 'true';

      let lastStatus = 200;
      let lastBody = null;

      const fakeRes = {
        status(code) { lastStatus = code; return this; },
        json(body) { lastBody = body; return this; },
      };

      // Execute 20 requests — all should pass
      for (let i = 0; i < 20; i++) {
        let calledNext = false;
        limiter({}, fakeRes, () => { calledNext = true; });
        assert.equal(calledNext, true, `Request ${i + 1} should pass`);
      }

      // 21st request must trigger 429 rate limit
      let calledNext21 = false;
      limiter({}, fakeRes, () => { calledNext21 = true; });
      assert.equal(calledNext21, false, '21st request should be rate-limited');
      assert.equal(lastStatus, 429);
      assert.equal(lastBody.error, 'rate_limited');
      assert.ok(lastBody.retry_after_seconds <= 180, `Retry after (${lastBody.retry_after_seconds}s) should not exceed 180s`);
      assert.ok(lastBody.retry_after_seconds > 0);
    } finally {
      process.env.NODE_ENV = savedEnv;
      if (savedTestRl) process.env.TEST_RATE_LIMIT = savedTestRl;
      else delete process.env.TEST_RATE_LIMIT;
    }
  });

  await t.test('dynamic function config evaluates at request time', () => {
    let dynamicMax = 2;
    const limiter = rateLimit({
      windowMs: 60_000,
      max: () => dynamicMax,
      prefix: 'dynamic_fn_rl',
      keyFn: () => 'user-dynamic-1',
    });

    const savedTestRl = process.env.TEST_RATE_LIMIT;
    try {
      process.env.TEST_RATE_LIMIT = 'true';

      let status = 200;
      const fakeRes = {
        status(code) { status = code; return this; },
        json(body) { return this; },
      };

      limiter({}, fakeRes, () => {});
      limiter({}, fakeRes, () => {});
      assert.equal(status, 200);

      // 3rd request blocked at max=2
      limiter({}, fakeRes, () => {});
      assert.equal(status, 429);

      // Now increase dynamicMax to 5 for a new key
      dynamicMax = 5;
      const limiter2 = rateLimit({
        windowMs: 60_000,
        max: () => dynamicMax,
        prefix: 'dynamic_fn_rl2',
        keyFn: () => 'user-dynamic-2',
      });

      let passedCount = 0;
      for (let i = 0; i < 5; i++) {
        limiter2({}, fakeRes, () => { passedCount++; });
      }
      assert.equal(passedCount, 5);
    } finally {
      if (savedTestRl) process.env.TEST_RATE_LIMIT = savedTestRl;
      else delete process.env.TEST_RATE_LIMIT;
    }
  });
});
