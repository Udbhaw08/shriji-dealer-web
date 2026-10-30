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

const { initTokens, hasSession, sessionFromAuth, PREFS_KEY, SESSION_PROFILE_KEY, SESSION_TTL_MS } = await import("./auth.js");
const { isValidEmail, isValidName, isValidPhone } = await import("./validators.js");

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

test("sessionFromAuth constructs pure customer session for email and Google signups", () => {
  const customerUser = {
    id: "usr-google-999",
    email: "customer@gmail.com",
    role: "customer",
    status: "active",
    email_verified: true,
    full_name: "Google Customer",
    dealer_id: null,
  };

  const session = sessionFromAuth(customerUser, null);
  assert.equal(session.role, "customer", "Must be customer role");
  assert.equal(session.dealerId, null, "Must have no dealer ID");
  assert.equal(session.dealer, null, "Must have no dealer object");
  assert.equal(session.email_verified, true, "Email verified must reflect user record");
});

test("sessionFromAuth preserves verified dealer credentials across login sessions", () => {
  const dealerUser = {
    id: "usr-dealer-888",
    email: "owner@dealership.com",
    role: "dealer",
    status: "active",
    email_verified: true,
    full_name: "Dealer Principal",
    dealer_id: "dlr-1234",
  };

  const dealerRecord = {
    id: "dlr-1234",
    business_name: "Sunshine Hub Delhi",
    dealer_code: "DE-DL-001",
    status: "approved",
    price_tier: "MH Dist Basic Oct 2026",
    pricebook_id: "pb-3334",
  };

  const session = sessionFromAuth(dealerUser, dealerRecord);
  assert.equal(session.role, "dealer", "Must be dealer role");
  assert.equal(session.dealerId, "dlr-1234");
  assert.equal(session.dealer?.name, "Sunshine Hub Delhi");
  assert.equal(session.dealer?.dealer_code, "DE-DL-001");
  assert.equal(session.canSeeDealerPrice, true);
});

test("sessionFromAuth constructs accurate staff session with dealer details", () => {
  const staffUser = {
    id: "usr-staff-777",
    email: "staff@dealership.com",
    role: "dealer_staff",
    status: "active",
    email_verified: true,
    phone: "9876543210",
    phone_verified: true,
    full_name: "Rahul Verma",
    dealer_id: "dlr-1234",
    can_see_dealer_price: true,
  };

  const dealerRecord = {
    id: "dlr-1234",
    business_name: "Sunshine Hub Delhi",
    dealer_code: "DE-DL-001",
    city: "Delhi",
    state: "Delhi",
    phone: "9811122233",
    status: "approved",
    price_tier: "MH Dist Basic Oct 2026",
    pricebook_id: "pb-3334",
    gst_number: "27AJHPJ2192C1ZF",
  };

  const session = sessionFromAuth(staffUser, dealerRecord);
  assert.equal(session.role, "dealer", "Must be on dealer side");
  assert.equal(session.authRole, "dealer_staff", "authRole must be dealer_staff");
  assert.equal(session.fullName, "Rahul Verma");
  assert.equal(session.phone, "9876543210");
  assert.equal(session.dealerId, "dlr-1234");
  assert.equal(session.dealer?.name, "Sunshine Hub Delhi");
  assert.equal(session.dealer?.dealer_code, "DE-DL-001");
  assert.equal(session.dealer?.city, "Delhi");
  assert.equal(session.dealer?.gst_number, "27AJHPJ2192C1ZF");
  assert.equal(session.canSeeDealerPrice, true);
});

test("Client-side validation rules for login and signup", () => {
  // Valid email
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("john.doe@company.co.in"), true);
  assert.equal(isValidEmail("plainaddress"), false);
  assert.equal(isValidEmail("@missingusername.com"), false);
  assert.equal(isValidEmail("user@domain"), false);

  // Valid full name
  assert.equal(isValidName("Rajesh Sharma"), true);
  assert.equal(isValidName("O'Connor"), true);
  assert.equal(isValidName("A"), false, "Too short");
  assert.equal(isValidName(""), false);
  assert.equal(isValidName("John123"), false, "Numbers rejected");

  // Valid WhatsApp phone
  assert.equal(isValidPhone("9876543210"), true);
  assert.equal(isValidPhone("8826867932"), true);
  assert.equal(isValidPhone("1234567890"), false, "Must start with 6-9");
  assert.equal(isValidPhone("98765"), false, "Too short");
});


test("sessionFromAuth cleanly strips wholesale dealer privileges on rejection and restores them on re-approval", () => {
  const rejectedUser = {
    id: "usr-dealer-rejected",
    role: "dealer",
    status: "rejected",
    full_name: "Rejected Dealer",
  };

  const rejectedDealerRecord = {
    id: "dlr-rejected-123",
    business_name: "Sample Shop",
    status: "rejected",
    dealer_code: "DE-XYZ-9999",
    price_tier: "MH Dist Basic Oct 2026",
    pricebook_id: "pb-3334",
    reject_reason: "GST documentation incomplete",
  };

  // 1. REJECTED STATE: All wholesale privileges stripped
  const rejectedSession = sessionFromAuth(rejectedUser, rejectedDealerRecord);
  assert.equal(rejectedSession.status, "rejected");
  assert.equal(rejectedSession.canSeeDealerPrice, false, "canSeeDealerPrice MUST be false for rejected dealers");
  assert.equal(rejectedSession.dealer?.pricebookId, null, "pricebookId MUST be null for rejected dealers");
  assert.equal(rejectedSession.dealer?.dealer_code, null, "dealer_code MUST be hidden for rejected dealers");
  assert.equal(rejectedSession.dealer?.price_tier, null, "price_tier MUST be null for rejected dealers");
  assert.equal(rejectedSession.dealer?.reject_reason, "GST documentation incomplete", "rejection reason must be accessible to UI");

  // 2. RE-APPROVED STATE: Privileges fully restored
  const approvedUser = {
    ...rejectedUser,
    status: "active",
  };
  const approvedDealerRecord = {
    ...rejectedDealerRecord,
    status: "approved",
    reject_reason: null,
  };
  const approvedSession = sessionFromAuth(approvedUser, approvedDealerRecord);
  assert.equal(approvedSession.status, "approved");
  assert.equal(approvedSession.canSeeDealerPrice, true, "canSeeDealerPrice MUST be true for approved dealers");
  assert.equal(approvedSession.dealer?.pricebookId, "pb-3334", "pricebookId MUST be restored");
  assert.equal(approvedSession.dealer?.dealer_code, "DE-XYZ-9999", "dealer_code MUST be restored");
});
