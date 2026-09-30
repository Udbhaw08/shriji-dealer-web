import test from "node:test";
import assert from "node:assert/strict";

test("sliding window rate limiter tracks attempts within window", () => {
  const windowMs = 1000;
  const maxAttempts = 3;
  const hits = [];

  const checkRateLimit = (now) => {
    while (hits.length > 0 && now - hits[0] > windowMs) hits.shift();
    if (hits.length >= maxAttempts) return false;
    hits.push(now);
    return true;
  };

  assert.equal(checkRateLimit(100), true);
  assert.equal(checkRateLimit(200), true);
  assert.equal(checkRateLimit(300), true);
  assert.equal(checkRateLimit(400), false); // Exceeded
  assert.equal(checkRateLimit(1200), true); // First expired
});
