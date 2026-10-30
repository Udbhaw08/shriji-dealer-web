import { test } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage and sessionStorage for Node.js test environment
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

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  localStorage: new MockStorage(),
  sessionStorage: new MockStorage(),
};
globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  visibilityState: "visible",
};
globalThis.localStorage = globalThis.window.localStorage;
globalThis.sessionStorage = globalThis.window.sessionStorage;

const { isDealer, tierOf, viewerFor, priceFor } = await import("./dealer.js");
const {
  INCOGNITO_KEY,
  isIncognitoMode,
  canUseIncognito,
  applyIncognito,
  setIncognitoMode,
  toggleIncognitoMode,
  switchToDealerSession,
} = await import("./session.js");

test("isDealer returns false when isIncognito is true", () => {
  const approvedDealer = {
    role: "dealer",
    status: "approved",
    dealerId: "dealer-1",
    canSeeDealerPrice: true,
  };
  assert.equal(isDealer(approvedDealer), true, "Approved dealer should have isDealer = true");

  const incognitoDealer = {
    ...approvedDealer,
    isIncognito: true,
  };
  assert.equal(isDealer(incognitoDealer), false, "Incognito dealer must have isDealer = false");
});

test("tierOf returns 'customer' when session is in incognito mode", () => {
  const approvedDealer = {
    role: "dealer",
    status: "approved",
    dealerId: "dealer-1",
  };
  assert.equal(tierOf(approvedDealer), "dealer");

  const incognitoDealer = {
    ...approvedDealer,
    role: "customer",
    isIncognito: true,
  };
  assert.equal(tierOf(incognitoDealer), "customer", "Incognito mode must report customer tier");
});

test("viewerFor forces customerView = true and me = null when isIncognito is true", () => {
  const approvedDealer = {
    role: "dealer",
    status: "approved",
    dealerId: "dealer-1",
    dealer: { id: "dealer-1", name: "Test Dealership", phone: "9876543210" },
  };

  // Normal dealer view (not shared link, not incognito)
  const normalView = viewerFor(approvedDealer, null);
  assert.equal(normalView.customerView, false, "Normal dealer should not be in customerView");
  assert.ok(normalView.me, "Normal dealer has me object populated");

  // Incognito dealer view
  const incognitoView = viewerFor({ ...approvedDealer, isIncognito: true }, null);
  assert.equal(incognitoView.customerView, true, "Incognito dealer must have customerView = true");
  assert.equal(incognitoView.me, null, "Incognito dealer must have me = null");
});

test("applyIncognito masks dealer privileges and preserves raw session", () => {
  globalThis.localStorage.setItem(INCOGNITO_KEY, "true");

  const dealerSession = {
    role: "dealer",
    authRole: "dealer",
    status: "approved",
    canSeeDealerPrice: true,
    dealerId: "fa0e9ef4-29d5-4816-9e22-c3fefee354be",
    dealer: { name: "ownershop", pricebookId: "pb-123" },
  };

  const masked = applyIncognito(dealerSession);

  assert.equal(masked.isIncognito, true);
  assert.equal(masked.role, "customer", "Role must be masked to customer");
  assert.equal(masked.authRole, "customer", "AuthRole must be masked to customer");
  assert.equal(masked.canSeeDealerPrice, false, "canSeeDealerPrice must be false in incognito");
  assert.equal(masked.rawRole, "dealer", "Original role preserved in rawRole");
  assert.equal(masked.rawCanSeeDealerPrice, true, "Original canSeeDealerPrice preserved in rawCanSeeDealerPrice");
  assert.equal(isDealer(masked), false, "isDealer(masked) must be false");

  globalThis.localStorage.removeItem(INCOGNITO_KEY);
});

test("canUseIncognito correctly identifies eligible users", () => {
  globalThis.localStorage.clear();

  assert.equal(canUseIncognito(null), false);
  assert.equal(canUseIncognito({ role: "guest" }), false);
  assert.equal(canUseIncognito({ role: "dealer", status: "pending" }), false);
  assert.equal(canUseIncognito({ role: "dealer", status: "approved", dealer: { id: "d1" } }), true);
  assert.equal(canUseIncognito({ role: "dealer_staff", authRole: "dealer_staff", status: "approved" }), true);

  // When incognito is active, canUseIncognito must return true even if role is masked to customer
  assert.equal(canUseIncognito({ role: "customer", isIncognito: true }), true);
});

test("setIncognitoMode and toggleIncognitoMode update storage and state cleanly", () => {
  globalThis.localStorage.clear();

  switchToDealerSession();

  assert.equal(isIncognitoMode(), false);

  // Turn Incognito ON
  setIncognitoMode(true);
  assert.equal(isIncognitoMode(), true);
  assert.equal(globalThis.localStorage.getItem(INCOGNITO_KEY), "true");

  // Toggle Incognito OFF
  const turnedOff = toggleIncognitoMode();
  assert.equal(turnedOff, false);
  assert.equal(isIncognitoMode(), false);
  assert.equal(globalThis.localStorage.getItem(INCOGNITO_KEY), null);

  // Toggle Incognito back ON
  const turnedOn = toggleIncognitoMode();
  assert.equal(turnedOn, true);
  assert.equal(isIncognitoMode(), true);

  // Clean up
  setIncognitoMode(false);
});

test("priceFor yields customer MRP when dealer is null in incognito mode", () => {
  const product = { id: "p1", name: "Hobtop 4B", mrp: 7999, dealerRate: 4999 };

  // In incognito mode, viewerFor sets me: null
  const incognitoPrice = priceFor(product, null);
  assert.equal(incognitoPrice.mrp, 7999);
  assert.equal(incognitoPrice.dealer, 7999, "Wholesale dealer rate is NOT exposed when dealer is null");
  assert.equal(incognitoPrice.rebatePct, 0);
});
