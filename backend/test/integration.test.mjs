/**
 * End-to-end integration tests: signup → dealer apply → CRM approval webhook →
 * price proxy role gating → staff invite lifecycle.
 *
 * Requires a throwaway Postgres/Supabase database:
 *   TEST_DATABASE_URL=postgres://... npm test
 * Without it, the suite skips (unit tests still run).
 */
process.env.NODE_ENV = 'test';
process.env.ENABLE_JOBS = 'false';
process.env.JWT_SECRET = 'test-secret-for-integration';
process.env.WEBHOOK_SECRET = 'whsec-test';

if (!process.env.TEST_DATABASE_URL) {
  console.log('[integration] TEST_DATABASE_URL not set — skipping integration suite');
  process.exit(0);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

import { test, mock, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// ---- Mock the Zoho clients (no network) ------------------------------------
const crmMock = { accountId: 'ACC-TEST-1', contactId: 'CON-TEST-1', account: null, fail: false };
mock.module('../src/services/crmClient.js', {
  namedExports: {
    isCrmConfigured: () => true,
    createDealerAccount: async () => {
      if (crmMock.fail) throw new Error('CRM down');
      return crmMock.accountId;
    },
    createDealerContact: async () => {
      if (crmMock.fail) throw new Error('CRM down');
      return crmMock.contactId;
    },
    linkContactToBackendUser: async () => {
      if (crmMock.fail) throw new Error('CRM down');
    },
    getDealerAccount: async (id) => crmMock.account,
    syncAccountUserSourceToContacts: async () => true,
    getPrimaryContactForAccount: async () => null,
  },
});

const COMMERCE_FIXTURE = [
  { product_id: 'p1', name: 'Mixer 500W', sku: 'MX500', mrp: 2499, dealer_rate: 1899 },
  { product_id: 'p2', name: 'Zero-priced item', sku: 'ZP1', mrp: 0, dealer_rate: null },
];
mock.module('../src/services/commerceClient.js', {
  namedExports: {
    isCommerceConfigured: () => true,
    fetchCatalog: async () => COMMERCE_FIXTURE,
    fetchPricebookRates: async () => ({ p1: 1899 }),
  },
});

// ---- Boot the app against the real test DB ---------------------------------
const { migrate } = await import('../src/db/migrate.js');
const { sql } = await import('../src/db/pool.js');
const app = (await import('../src/server.js')).default;

await migrate();

const server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;

// without this the open server + pooled connections keep the process alive forever
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sql.end({ timeout: 5 });
});

const api = async (method, path, { token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
};

const uniq = () => `t${Date.now()}${Math.floor(Math.random() * 1e6)}@test.shriji`;
let run = 0;

beforeEach(async () => {
  // clean slate per test — order matters for FKs; migration bookkeeping rows
  // in sync_state survive so migrate() never re-applies 001_init.sql
  await sql`truncate table users, dealers, staff_invites, refresh_tokens, otp_codes,
            audit_log, webhook_events, catalog_cache`;
  await sql`delete from sync_state where key not like 'migration:%'`;
  crmMock.account = null;
  crmMock.fail = false;
});

test('health endpoint reports db up', async () => {
  const res = await api('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.json.db, 'up');
});

test('signup → me: customer can browse, MRP-only prices', async () => {
  const email = uniq();
  const signup = await api('POST', '/api/auth/signup', { body: { email, password: 'password123' } });
  assert.equal(signup.status, 201);
  assert.equal(signup.json.user.role, 'customer');
  assert.ok(signup.json.accessToken);

  // seed the catalog cache via the service
  const { syncCatalog } = await import('../src/services/catalog.js');
  await syncCatalog();

  const me = await api('GET', '/api/auth/me', { token: signup.json.accessToken });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, email);

  const prices = await api('GET', '/api/prices', { token: signup.json.accessToken });
  assert.equal(prices.status, 200);
  for (const p of prices.json.products) {
    assert.equal('dealer_rate' in p, false);
    if (p.product_id === 'p2') assert.equal(p.price_on_request, true); // never ₹0
  }
});

test('login rejects wrong password', async () => {
  const email = uniq();
  await api('POST', '/api/auth/signup', { body: { email, password: 'password123' } });
  const bad = await api('POST', '/api/auth/login', { body: { email, password: 'wrong-password' } });
  assert.equal(bad.status, 401);
});

test('dealer apply → CRM webhook approval → dealer prices unlock', async () => {
  const email = uniq();
  const signup = await api('POST', '/api/auth/signup', { body: { email, password: 'password123' } });
  const token = signup.json.accessToken;

  // before approval, a dealer role cannot manage staff
  const early = await api('POST', '/api/dealers/staff/invite', { token, body: {} });
  assert.equal(early.status, 403);

  const apply = await api('POST', '/api/dealers/apply', {
    token,
    body: { business_name: 'Test Electronics', gst_number: '27ABCDE1234F1Z5', person_name: 'Owner', phone: '9800000000' },
  });
  assert.equal(apply.status, 201);

  const mePending = await api('GET', '/api/auth/me', { token });
  assert.equal(mePending.json.dealer.status, 'pending');
  assert.equal(mePending.json.user.status, 'pending');

  // owner flips Dealer Status in CRM → workflow fires the webhook
  crmMock.account = {
    zohoAccountId: crmMock.accountId,
    dealerStatus: 'Approved',
    dealerCode: 'SHR-001',
    priceTier: 'Tier A',
  };
  const hookRes = await fetch(`${BASE}/webhooks/crm/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'whsec-test' },
    body: JSON.stringify({ id: crmMock.accountId }),
  });
  assert.equal(hookRes.status, 200);
  const hookJson = await hookRes.json();
  assert.equal(hookJson.changed, true);
  assert.equal(hookJson.status, 'Approved');

  const meApproved = await api('GET', '/api/auth/me', { token });
  assert.equal(meApproved.json.dealer.status, 'approved');
  assert.equal(meApproved.json.dealer.dealer_code, 'SHR-001');
  assert.equal(meApproved.json.user.status, 'active');

  const prices = await api('GET', '/api/prices', { token });
  const p1 = prices.json.products.find((p) => p.product_id === 'p1');
  assert.equal(p1.dealer_rate, 1899);
  const p2 = prices.json.products.find((p) => p.product_id === 'p2');
  assert.equal(p2.price_on_request, true);
});

test('webhook replay is deduped — second call is a no-op', async () => {
  const email = uniq();
  const signup = await api('POST', '/api/auth/signup', { body: { email, password: 'password123' } });
  await api('POST', '/api/dealers/apply', {
    token: signup.json.accessToken,
    body: { business_name: 'Dedup Traders' },
  });

  crmMock.account = { zohoAccountId: crmMock.accountId, dealerStatus: 'Approved', dealerCode: 'SHR-002', priceTier: null };

  const send = () => fetch(`${BASE}/webhooks/crm/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'whsec-test' },
    body: JSON.stringify({ id: crmMock.accountId }),
  });

  const first = await (await send()).json();
  assert.equal(first.changed, true);
  const replay = await (await send()).json();
  assert.equal(replay.deduped, true);

  // and the payload fields alone cannot flip status — CRM re-fetch is the source of truth
  const wrongSecret = await fetch(`${BASE}/webhooks/crm/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'nope' },
    body: JSON.stringify({ id: crmMock.accountId }),
  });
  assert.equal(wrongSecret.status, 401);
});

test('staff lifecycle: invite → signup (pending) → approve → revoke', async () => {
  const ownerEmail = uniq();
  const staffEmail = uniq();
  const owner = await api('POST', '/api/auth/signup', { body: { email: ownerEmail, password: 'password123' } });

  await api('POST', '/api/dealers/apply', {
    token: owner.json.accessToken,
    body: { business_name: 'Staff Flow Traders' },
  });
  crmMock.account = { zohoAccountId: crmMock.accountId, dealerStatus: 'Approved', dealerCode: 'SHR-003', priceTier: null };
  await fetch(`${BASE}/webhooks/crm/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'whsec-test' },
    body: JSON.stringify({ id: crmMock.accountId }),
  });

  const invite = await api('POST', '/api/dealers/staff/invite', { token: owner.json.accessToken, body: {} });
  assert.equal(invite.status, 201);
  assert.ok(invite.json.code);

  const staffSignup = await api('POST', '/api/auth/staff/signup', {
    body: { email: staffEmail, password: 'password123', invite_code: invite.json.code },
  });
  assert.equal(staffSignup.status, 201);
  assert.equal(staffSignup.json.status, 'pending');

  // invite code is single-use
  const reuse = await api('POST', '/api/auth/staff/signup', {
    body: { email: uniq(), password: 'password123', invite_code: invite.json.code },
  });
  assert.equal(reuse.status, 401);

  // dealer sees and approves the pending staff
  const list = await api('GET', '/api/dealers/staff', { token: owner.json.accessToken });
  assert.equal(list.json.staff.length, 1);
  const staffId = list.json.staff[0].id;
  assert.equal(list.json.staff[0].status, 'pending');

  const approved = await api('POST', `/api/dealers/staff/${staffId}/approve`, { token: owner.json.accessToken });
  assert.equal(approved.status, 200);

  // approved staff logs in and sees dealer rates
  const staffLogin = await api('POST', '/api/auth/login', { body: { email: staffEmail, password: 'password123' } });
  assert.equal(staffLogin.status, 200);
  assert.equal(staffLogin.json.user.role, 'dealer_staff');
  const { syncCatalog } = await import('../src/services/catalog.js');
  await syncCatalog();
  const staffPrices = await api('GET', '/api/prices', { token: staffLogin.json.accessToken });
  const p1 = staffPrices.json.products.find((p) => p.product_id === 'p1');
  assert.equal(p1.dealer_rate, 1899);

  // revoke cuts the staff user off immediately
  await api('POST', `/api/dealers/staff/${staffId}/revoke`, { token: owner.json.accessToken });
  const afterRevoke = await api('GET', '/api/auth/me', { token: staffLogin.json.accessToken });
  assert.equal(afterRevoke.status, 401);
});

test('refresh token rotates; reuse of the old token kills the family', async () => {
  const email = uniq();
  const signup = await api('POST', '/api/auth/signup', { body: { email, password: 'password123' } });
  const rt = signup.json.refreshToken;

  const first = await api('POST', '/api/auth/refresh', { body: { refreshToken: rt } });
  assert.equal(first.status, 200);
  assert.ok(first.json.refreshToken);
  assert.notEqual(first.json.refreshToken, rt);

  // replaying the consumed token revokes everything
  const replay = await api('POST', '/api/auth/refresh', { body: { refreshToken: rt } });
  assert.equal(replay.status, 401);
  const family = await api('POST', '/api/auth/refresh', { body: { refreshToken: first.json.refreshToken } });
  assert.equal(family.status, 401);
});

test('rejected by CRM → user locked out of /me', async () => {
  const email = uniq();
  const signup = await api('POST', '/api/auth/signup', { body: { email, password: 'password123' } });
  await api('POST', '/api/dealers/apply', {
    token: signup.json.accessToken,
    body: { business_name: 'Reject Traders' },
  });

  crmMock.account = { zohoAccountId: crmMock.accountId, dealerStatus: 'Rejected', dealerCode: null, priceTier: null };
  await fetch(`${BASE}/webhooks/crm/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'whsec-test' },
    body: JSON.stringify({ id: crmMock.accountId }),
  });

  const me = await api('GET', '/api/auth/me', { token: signup.json.accessToken });
  assert.equal(me.status, 401); // rejected accounts are cut off immediately
});
