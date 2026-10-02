import test from "node:test";
import assert from "node:assert/strict";

test("session sliding window marks session expired after 30 days of inactivity", () => {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const isSessionValid = (lastActivity, now = Date.now()) => (now - lastActivity) < THIRTY_DAYS_MS;

  const now = 1700000000000;
  const activeSession = now - (10 * 24 * 60 * 60 * 1000);
  const expiredSession = now - (31 * 24 * 60 * 60 * 1000);

  assert.equal(isSessionValid(activeSession, now), true);
  assert.equal(isSessionValid(expiredSession, now), false);
});
