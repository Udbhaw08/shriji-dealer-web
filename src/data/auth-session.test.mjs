import { test } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage and sessionStorage in Node test environment
class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.window = globalThis;
globalThis.localStorage = new MockStorage();
globalThis.sessionStorage = new MockStorage();

const { initTokens, hasSession, PREFS_KEY, SESSION_PROFILE_KEY, SESSION_TTL_MS } = await import("./auth.js");

test("session tokens are preserved in localStorage with 30-day sliding window", async () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();

  const now = Date.now();
  const testTokens = {
    accessToken: "test_access_jwt_123",
    refreshToken: "test_refresh_random_456",
    savedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify(testTokens));

  await initTokens();

  assert.equal(hasSession(), true, "Session should be detected from persistent localStorage");

  const stored = JSON.parse(globalThis.localStorage.getItem(PREFS_KEY));
  assert.equal(stored.accessToken, "test_access_jwt_123");
  assert.equal(stored.refreshToken, "test_refresh_random_456");
  assert.ok(stored.expiresAt >= now + SESSION_TTL_MS - 1000, "Sliding 30-day window should be updated");
});

test("legacy tokens in sessionStorage are migrated to localStorage on startup", async () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();

  const legacyTokens = {
    accessToken: "legacy_access_token",
    refreshToken: "legacy_refresh_token",
  };

  globalThis.sessionStorage.setItem(PREFS_KEY, JSON.stringify(legacyTokens));

  await initTokens();

  assert.equal(hasSession(), true, "Legacy session should be recovered");
  assert.ok(globalThis.localStorage.getItem(PREFS_KEY), "Tokens should be migrated to localStorage");
  assert.equal(globalThis.sessionStorage.getItem(PREFS_KEY), null, "sessionStorage should be cleaned up");
});

test("session expires if inactivity exceeds 30 days", async () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();

  const expiredTokens = {
    accessToken: "expired_access_token",
    refreshToken: "expired_refresh_token",
    savedAt: Date.now() - (35 * 24 * 60 * 60 * 1000), // 35 days ago
    expiresAt: Date.now() - (5 * 24 * 60 * 60 * 1000), // expired 5 days ago
  };

  globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify(expiredTokens));
  globalThis.localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify({ role: "dealer", status: "approved" }));

  await initTokens();

  assert.equal(hasSession(), false, "Expired session should not be loaded");
  assert.equal(globalThis.localStorage.getItem(PREFS_KEY), null, "Expired tokens should be purged from localStorage");
  assert.equal(globalThis.localStorage.getItem(SESSION_PROFILE_KEY), null, "Expired profile should be purged");
});
