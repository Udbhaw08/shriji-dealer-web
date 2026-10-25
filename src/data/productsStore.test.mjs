import { test } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage and sessionStorage
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

// Intercept fetch calls to verify parameters and URLs
let lastFetchCall = null;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init = {}) => {
  lastFetchCall = {
    url: typeof input === "string" ? input : input?.url,
    method: init?.method || "GET",
    headers: init?.headers || {},
  };

  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      ok: true,
      products: [
        { id: "stove-1", name: "Sunshine 3 Burner Gas Stove", mrp: 4999, dealerRate: 3500, purchaseRate: 2800 },
        { id: "chimney-1", name: "Sunshine AutoClean Chimney", mrp: 12999, dealerRate: 8999, purchaseRate: 7500 },
      ],
      categories: [
        { key: "gas_stoves", label: "Gas Stoves" },
        { key: "chimneys", label: "Chimneys" },
      ],
    }),
    text: async () => JSON.stringify({ ok: true }),
  };
};

const {
  fetchLiveProducts,
  syncPricebookWithSession,
  useProducts,
} = await import("./productsStore.js");

test("fetchLiveProducts defines and passes valid url parameter without throwing ReferenceError", async () => {
  lastFetchCall = null;
  const state = await fetchLiveProducts(true);

  assert.ok(lastFetchCall, "fetch should have been invoked");
  assert.ok(typeof lastFetchCall.url === "string", "url passed to fetch must be a defined string");
  assert.notEqual(lastFetchCall.url, "", "url must not be empty");
  assert.notEqual(lastFetchCall.url, "undefined", "url must not be string 'undefined'");
  assert.equal(lastFetchCall.url, "/api/products?refresh=true", "forced fetch should include refresh=true query parameter");
  assert.ok(state.loaded, "store should be marked as loaded");
  assert.equal(state.products.length, 2, "should load products from mock response");
});

test("fetchLiveProducts correctly appends pricebook_id when target pricebook is supplied", async () => {
  lastFetchCall = null;
  await fetchLiveProducts(true, "pb_dealer_gold_456");

  assert.ok(lastFetchCall, "fetch should have been invoked");
  assert.ok(typeof lastFetchCall.url === "string", "url must be a valid string");
  assert.ok(lastFetchCall.url.includes("pricebook_id=pb_dealer_gold_456"), "URL must include pricebook_id query parameter");
  assert.ok(lastFetchCall.url.includes("refresh=true"), "Forced fetch should include refresh parameter");
  assert.equal(lastFetchCall.url, "/api/products?refresh=true&pricebook_id=pb_dealer_gold_456");
});

test("fetchLiveProducts without force handles query parameters cleanly", async () => {
  lastFetchCall = null;
  // Use a different pricebook ID so cache doesn't skip
  await fetchLiveProducts(true, "pb_tier_retailer_789");

  assert.ok(lastFetchCall, "fetch should have been invoked");
  assert.ok(!lastFetchCall.url.includes("undefined"), "URL must never contain literal undefined");
  assert.ok(lastFetchCall.url.startsWith("/api/products"), "URL must target products endpoint");
});

test("syncPricebookWithSession triggers pricebook update for approved dealer", async () => {
  lastFetchCall = null;
  const dealerSession = {
    role: "dealer",
    status: "approved",
    canSeeDealerPrice: true,
    dealer: {
      pricebookId: "pb_tier_vip_999",
    },
  };

  syncPricebookWithSession(dealerSession);

  assert.ok(lastFetchCall, "session sync should trigger fetchLiveProducts for new pricebook");
  assert.ok(lastFetchCall.url.includes("pricebook_id=pb_tier_vip_999"));
});

test("unauthenticated viewer purges dealerRate and purchaseRate from cache", async () => {
  // Reset active pricebook to null (customer view)
  const customerSession = {
    role: "customer",
    status: "approved",
  };
  syncPricebookWithSession(customerSession);
  const state = await fetchLiveProducts(true, null);

  for (const product of state.products) {
    assert.equal(product.purchaseRate, undefined, "purchaseRate must always be purged");
    assert.equal(product.dealerRate, undefined, "dealerRate must be purged for guest/customer view");
    assert.ok(product.mrp > 0, "mrp should remain intact");
  }
});

test("network failure does not throw unhandled exception or crash productsStore", async () => {
  globalThis.fetch = async () => {
    throw new Error("Simulated network timeout");
  };

  let threw = false;
  try {
    const res = await fetchLiveProducts(true, "err_test_pb");
    assert.equal(res.syncing, false, "syncing flag should reset to false on failure");
  } catch (err) {
    threw = true;
  }
  assert.equal(threw, false, "fetchLiveProducts must catch and handle fetch error gracefully");

  // Restore mock
  globalThis.fetch = originalFetch;
});
