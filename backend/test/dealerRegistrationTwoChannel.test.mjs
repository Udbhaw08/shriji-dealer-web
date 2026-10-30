import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'node:crypto';
import { hashOtp, verifyOtpHash } from '../src/utils/hash.js';
import { generateUniqueDealerCode } from '../src/utils/loginCode.js';

// Setup test env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-dealer-reg-two-channel';
process.env.ENABLE_DEV_OTP = 'true';

const testEnv = {
  jwtSecret: 'test-jwt-secret-dealer-reg-two-channel',
  googleClientId: 'test-google-client-id',
  enableDevOtp: 'true',
  whatsapp: { token: 't', phoneId: 'p', templateName: 'otp', templateLang: 'en_US', graphApiVersion: 'v21.0', templateHasButton: true },
  zoho: {
    dc: 'in',
    crm: { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
    commerce: { accountNumber: '1', clientId: 'c', clientSecret: 's', refreshToken: 'r', dealerPricebookId: 'pb-dealer-default' },
  },
};

// In-memory test database state
const db = {
  dealerRegistrationFlows: [],
  dealerOtpCooldowns: new Map(),
  users: [],
  dealers: [],
  refreshTokens: [],
  auditLog: [],
  syncState: {},
};

let nextId = 5000;
function resetDb() {
  db.dealerRegistrationFlows = [];
  db.dealerOtpCooldowns.clear();
  db.users = [];
  db.dealers = [];
  db.refreshTokens = [];
  db.auditLog = [];
  db.syncState = {};
  nextId = 5000;
  dbFailOnInsertDealer = false;
  dbFailOnInsertUser = false;
}

let dbFailOnInsertDealer = false;
let dbFailOnInsertUser = false;

const crmCalls = {
  createdAccounts: [],
  createdContacts: [],
  linkedContacts: [],
  failAccountCreate: false,
  failContactCreate: false,
};

function resetCrmCalls() {
  crmCalls.createdAccounts = [];
  crmCalls.createdContacts = [];
  crmCalls.linkedContacts = [];
  crmCalls.failAccountCreate = false;
  crmCalls.failContactCreate = false;
}

// In-memory SQL tag mock
function mockSql(strings, ...values) {
  const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), '');
  const qLower = query.toLowerCase();

  // AUDIT LOG
  if (qLower.includes('insert into audit_log')) {
    db.auditLog.push({ userId: values[0], action: values[1], entityType: values[2], entityId: values[3], meta: values[4] });
    return Promise.resolve([]);
  }

  // SYNC STATE
  if (qLower.includes('insert into sync_state')) {
    db.syncState[values[0]] = values[1];
    return Promise.resolve([]);
  }

  // DEALER OTP COOLDOWNS
  if (qLower.includes('insert into dealer_otp_cooldowns')) {
    const contactKey = values[0];
    const existing = db.dealerOtpCooldowns.get(contactKey);
    if (existing && Date.now() - existing.getTime() < 60_000) {
      return Promise.resolve([]); // Cooldown active, 0 rows returned
    }
    const now = new Date();
    db.dealerOtpCooldowns.set(contactKey, now);
    return Promise.resolve([{ last_sent_at: now }]);
  }
  if (qLower.includes('delete from dealer_otp_cooldowns')) {
    const contactKey = values[0];
    db.dealerOtpCooldowns.delete(contactKey);
    return Promise.resolve([]);
  }
  if (qLower.includes('select') && qLower.includes('from dealer_otp_cooldowns')) {
    const contactKey = values[0];
    const existing = db.dealerOtpCooldowns.get(contactKey);
    return Promise.resolve(existing ? [{ last_sent_at: existing }] : []);
  }

  // DEALER REGISTRATION FLOWS — INSERT
  if (qLower.includes('insert into dealer_registration_flows')) {
    const isPhoneFirst = query.includes('(phone, expires_at)');
    const isEmailFirst = query.includes('(email, expires_at)');
    const id = crypto.randomUUID();
    const newFlow = {
      id,
      phone: isPhoneFirst ? values[0] : null,
      phone_otp_hash: null,
      phone_otp_expires_at: null,
      phone_attempts: 0,
      phone_verified: false,
      phone_verified_at: null,
      email: isEmailFirst ? values[0] : null,
      email_otp_hash: null,
      email_otp_expires_at: null,
      email_attempts: 0,
      email_verified: false,
      email_verified_at: null,
      verification_token_hash: null,
      expires_at: new Date(Date.now() + 30 * 60_000),
      consumed_at: null,
      created_at: new Date(),
    };
    db.dealerRegistrationFlows.push(newFlow);
    return Promise.resolve([newFlow]);
  }

  // DEALER REGISTRATION FLOWS — SELECT
  if (qLower.includes('from dealer_registration_flows')) {
    let matches = [...db.dealerRegistrationFlows];
    if (query.includes('where id =')) {
      const id = values[0];
      matches = matches.filter((f) => f.id === id);
    }
    if (query.includes('consumed_at is null')) {
      matches = matches.filter((f) => !f.consumed_at);
    }
    if (query.includes('expires_at > now()')) {
      matches = matches.filter((f) => new Date(f.expires_at) > new Date());
    }
    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // DEALER REGISTRATION FLOWS — UPDATE
  if (qLower.includes('update dealer_registration_flows')) {
    // 1. Consume flow
    if (query.includes('set consumed_at = now()')) {
      const id = values[0];
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id && !f.consumed_at);
      if (flow) flow.consumed_at = new Date();
      return Promise.resolve(flow ? [flow] : []);
    }
    // 2. Request Phone OTP update (must be before phone_attempts)
    if (query.includes('phone_otp_expires_at =')) {
      const [phone, hash, expiresAt, id] = values;
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.phone = phone;
        flow.phone_otp_hash = hash;
        flow.phone_otp_expires_at = expiresAt;
        flow.phone_attempts = 0;
      }
      return Promise.resolve(flow ? [flow] : []);
    }
    // 3. Request Email OTP update (must be before email_attempts)
    if (query.includes('email_otp_expires_at =')) {
      const [email, hash, expiresAt, id] = values;
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.email = email;
        flow.email_otp_hash = hash;
        flow.email_otp_expires_at = expiresAt;
        flow.email_attempts = 0;
      }
      return Promise.resolve(flow ? [flow] : []);
    }
    // 4. Verify Phone success
    if (query.includes('phone_verified = true')) {
      const [phone, tokenHash, id] = values;
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.phone = phone;
        flow.phone_verified = true;
        flow.phone_verified_at = new Date();
        flow.phone_otp_hash = null;
        if (tokenHash) flow.verification_token_hash = tokenHash;
      }
      return Promise.resolve(flow ? [flow] : []);
    }
    // 5. Verify Email success
    if (query.includes('email_verified = true')) {
      const [email, tokenHash, id] = values;
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.email = email;
        flow.email_verified = true;
        flow.email_verified_at = new Date();
        flow.email_otp_hash = null;
        if (tokenHash) flow.verification_token_hash = tokenHash;
      }
      return Promise.resolve(flow ? [flow] : []);
    }
    // 6. Purge hashes or record max attempts
    if (query.includes('phone_otp_hash = null')) {
      let attempts, id;
      if (query.includes('phone_attempts =')) {
        attempts = values[0];
        id = values[1];
      } else {
        id = values[0];
      }
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.phone_otp_hash = null;
        if (attempts !== undefined) flow.phone_attempts = attempts;
      }
      return Promise.resolve([]);
    }
    if (query.includes('email_otp_hash = null')) {
      let attempts, id;
      if (query.includes('email_attempts =')) {
        attempts = values[0];
        id = values[1];
      } else {
        id = values[0];
      }
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.email_otp_hash = null;
        if (attempts !== undefined) flow.email_attempts = attempts;
      }
      return Promise.resolve([]);
    }
    // 7. Update phone attempts
    if (query.includes('phone_attempts =')) {
      const attempts = values[0];
      const id = values[1] !== undefined ? values[1] : values[0];
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.phone_attempts = attempts;
      }
      return Promise.resolve([]);
    }
    // 8. Update email attempts
    if (query.includes('email_attempts =')) {
      const attempts = values[0];
      const id = values[1] !== undefined ? values[1] : values[0];
      const flow = db.dealerRegistrationFlows.find((f) => f.id === id);
      if (flow) {
        flow.email_attempts = attempts;
      }
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }

  // USERS — SELECT
  if (qLower.includes('from users')) {
    let matches = [...db.users];
    if (query.includes('lower(email) =') || query.includes('phone =')) {
      const targetEmail = values[0];
      const targetPhone = values[1];
      matches = matches.filter(
        (u) =>
          (u.email && String(u.email).toLowerCase() === String(targetEmail).toLowerCase()) ||
          (u.phone && (u.phone === targetPhone || u.phone === values[2] || (values[3] && u.phone.includes(targetPhone))))
      );
    }
    if (query.includes('where id =')) {
      const id = values[0];
      matches = matches.filter((u) => u.id === id);
    }
    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // USERS — INSERT
  if (qLower.includes('insert into users')) {
    if (dbFailOnInsertUser) {
      throw new Error('Database Error: Simulated User Insert Failure');
    }
    const [email, phone, fullName] = values;
    const newUser = {
      id: crypto.randomUUID(),
      email,
      phone,
      full_name: fullName,
      role: 'dealer',
      status: 'pending',
      email_verified: true,
      phone_verified: true,
      dealer_id: null,
      zoho_contact_id: null,
      created_at: new Date(),
    };
    db.users.push(newUser);
    return Promise.resolve([newUser]);
  }

  // USERS — UPDATE
  if (qLower.includes('update users set dealer_id =')) {
    const [dealerId, userId] = values;
    const user = db.users.find((u) => u.id === userId);
    if (user) user.dealer_id = dealerId;
    return Promise.resolve(user ? [user] : []);
  }
  if (qLower.includes('update users set zoho_contact_id =')) {
    const [contactId, userId] = values;
    const user = db.users.find((u) => u.id === userId);
    if (user) user.zoho_contact_id = contactId;
    return Promise.resolve(user ? [user] : []);
  }

  // DEALERS — SELECT
  if (qLower.includes('from dealers')) {
    let matches = [...db.dealers];
    if (query.includes('from dealers where dealer_code =') || query.includes('from dealers where lower(dealer_code) =')) {
      const code = values[0];
      matches = matches.filter((d) => String(d.dealer_code).toLowerCase() === String(code).toLowerCase());
      return Promise.resolve(matches);
    }
    if (query.includes('owner_user_id =')) {
      const uId = values[0];
      matches = matches.filter((d) => d.owner_user_id === uId);
    }
    if (query.includes('where id =')) {
      const id = values[0];
      matches = matches.filter((d) => d.id === id);
    }
    // FOR CRMPoll: unlinked accounts
    if (query.includes('d.zoho_account_id is null') && query.includes("d.status = 'pending'")) {
      const res = [];
      for (const d of db.dealers) {
        if (d.status === 'pending' && !d.zoho_account_id) {
          const u = db.users.find((usr) => usr.id === d.owner_user_id) || {};
          res.push({
            id: d.id,
            business_name: d.business_name,
            gst_number: d.gst_number,
            gst_treatment: d.gst_treatment,
            address: d.address,
            dealer_code: d.dealer_code,
            owner_id: u.id,
            email: u.email,
            phone: u.phone,
            full_name: u.full_name,
          });
        }
      }
      return Promise.resolve(res);
    }
    // FOR CRMPoll: unlinked contacts
    if (query.includes('d.zoho_account_id is not null and u.zoho_contact_id is null')) {
      const res = [];
      for (const d of db.dealers) {
        if (d.zoho_account_id) {
          const u = db.users.find((usr) => usr.id === d.owner_user_id);
          if (u && !u.zoho_contact_id) {
            res.push({
              id: d.id,
              business_name: d.business_name,
              dealer_code: d.dealer_code,
              zoho_account_id: d.zoho_account_id,
              owner_id: u.id,
              email: u.email,
              phone: u.phone,
              full_name: u.full_name,
            });
          }
        }
      }
      return Promise.resolve(res);
    }
    // FOR CRMPoll: active dealers
    if (query.includes("status in ('pending', 'approved') and zoho_account_id is not null")) {
      matches = matches.filter((d) => ['pending', 'approved'].includes(d.status) && Boolean(d.zoho_account_id));
      return Promise.resolve(matches);
    }
    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // DEALERS — INSERT
  if (qLower.includes('insert into dealers')) {
    if (dbFailOnInsertDealer) {
      throw new Error('Database Error: Simulated Dealer Insert Failure');
    }
    const [ownerUserId, businessName, gstNumber, gstTreatment, address, dealerCode] = values;
    const newDealer = {
      id: crypto.randomUUID(),
      owner_user_id: ownerUserId,
      business_name: businessName,
      gst_number: gstNumber,
      gst_treatment: gstTreatment,
      address,
      status: 'pending',
      dealer_code: dealerCode,
      zoho_account_id: null,
      price_tier: null,
      created_at: new Date(),
    };
    db.dealers.push(newDealer);
    return Promise.resolve([newDealer]);
  }

  // DEALERS — UPDATE
  if (qLower.includes('update dealers set zoho_account_id =')) {
    const [accId, dealerId] = values;
    const dealer = db.dealers.find((d) => d.id === dealerId);
    if (dealer) dealer.zoho_account_id = accId;
    return Promise.resolve(dealer ? [dealer] : []);
  }

  // REFRESH TOKENS
  if (qLower.includes('insert into refresh_tokens')) {
    db.refreshTokens.push({ id: `rt-${nextId++}`, token_hash: values[0], user_id: values[1], revoked: false });
    return Promise.resolve([]);
  }

  return Promise.resolve([]);
}

// Transaction simulation with rollback capability
mockSql.begin = async (callback) => {
  const snapshot = {
    dealerRegistrationFlows: db.dealerRegistrationFlows.map((f) => ({ ...f })),
    users: db.users.map((u) => ({ ...u })),
    dealers: db.dealers.map((d) => ({ ...d })),
    refreshTokens: db.refreshTokens.map((r) => ({ ...r })),
    auditLog: db.auditLog.map((a) => ({ ...a })),
  };

  try {
    const res = await callback(mockSql);
    return res;
  } catch (txErr) {
    db.dealerRegistrationFlows = snapshot.dealerRegistrationFlows;
    db.users = snapshot.users;
    db.dealers = snapshot.dealers;
    db.refreshTokens = snapshot.refreshTokens;
    db.auditLog = snapshot.auditLog;
    throw txErr;
  }
};

// Mock CRM Client
const mockCrm = {
  isCrmConfigured: () => true,
  createDealerAccount: async (payload) => {
    if (crmCalls.failAccountCreate) {
      throw new Error('CRM Outage: createDealerAccount failed');
    }
    crmCalls.createdAccounts.push(payload);
    return `crm-acc-${nextId++}`;
  },
  createDealerContact: async (payload) => {
    if (crmCalls.failContactCreate) {
      throw new Error('CRM Outage: createDealerContact failed');
    }
    crmCalls.createdContacts.push(payload);
    return `crm-con-${nextId++}`;
  },
  linkContactToBackendUser: async (contactId, userId) => {
    crmCalls.linkedContacts.push({ contactId, userId });
    return true;
  },
  getDealerAccount: async (accId) => ({
    zohoAccountId: accId,
    dealerStatus: 'Pending',
    businessName: 'Mock Business',
  }),
  findOwnerContactInAccount: async () => null,
  getPrimaryContactForAccount: async () => null,
  syncAccountUserSourceToContacts: async () => true,
  updateDealerCodeInCrm: async () => true,
  deactivateAccountInCrm: async () => true,
  deactivateContactInCrm: async () => true,
};

// Notification mocks
const sentOtps = { whatsapp: [], email: [], failWhatsApp: false, failEmail: false };
const mockNotifications = {
  sendWhatsAppOtp: async ({ phone, code }) => {
    if (sentOtps.failWhatsApp) {
      throw new Error('Simulated WhatsApp API Outage (503 Service Unavailable)');
    }
    sentOtps.whatsapp.push({ phone, code });
    return { ok: true };
  },
  sendEmailOtp: async ({ email, code }) => {
    if (sentOtps.failEmail) {
      throw new Error('Simulated Email Provider Outage');
    }
    sentOtps.email.push({ email, code });
    return { ok: true };
  },
  notify: async () => ({ ok: true }),
};

// Module mocks
mock.module('../src/config/env.js', { namedExports: { env: testEnv } });
mock.module('../src/db/pool.js', { namedExports: { sql: mockSql } });
mock.module('../src/services/crmClient.js', { namedExports: mockCrm });
mock.module('../src/services/notifications.js', { namedExports: mockNotifications });
mock.module('../src/services/commerceClient.js', {
  namedExports: {
    ensureContactPricebookForCrmAccount: async () => true,
    resolvePricebookId: async (tier) => (tier ? `pb-${tier}` : testEnv.zoho.commerce.dealerPricebookId),
    isCommerceConfigured: () => true,
  },
});

const { dealersRouter } = await import('../src/routes/dealers.js');
const { authRouter } = await import('../src/routes/auth.js');
const { crmPoll } = await import('../src/jobs/crmPoll.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/dealers', dealersRouter);
app.use('/api/auth', authRouter);
app.use(errorHandler);

let server;
let baseUrl;

beforeEach(async () => {
  resetDb();
  resetCrmCalls();
  sentOtps.whatsapp = [];
  sentOtps.email = [];
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

// ============================================================================
// DEALER ONBOARDING: TWO-CHANNEL VERIFICATION TEST SUITE
// ============================================================================

test('1. Guest can start registration without a JWT', async () => {
  // Start phone OTP as guest
  const resPhone = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const dataPhone = await resPhone.json();
  assert.equal(resPhone.status, 200);
  assert.equal(dataPhone.ok, true);
  assert.ok(dataPhone.flowId, 'flowId must be generated');
  assert.equal(dataPhone.destination, 'phone');

  // Start email OTP on the same flow without a JWT
  const resEmail = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId: dataPhone.flowId, email: 'dealer@example.com' }),
  });
  const dataEmail = await resEmail.json();
  assert.equal(resEmail.status, 200);
  assert.equal(dataEmail.ok, true);
  assert.equal(dataEmail.flowId, dataPhone.flowId);
  assert.equal(dataEmail.destination, 'email');
});

test('2. Requesting an OTP writes no permanent user/dealer records and triggers no CRM call', async () => {
  const res = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(res.status, 200);

  // Assert NO permanent database records exist
  assert.equal(db.users.length, 0, 'No permanent user rows must be written');
  assert.equal(db.dealers.length, 0, 'No permanent dealer rows must be written');
  assert.equal(db.refreshTokens.length, 0, 'No session refresh token must be issued');

  // Assert NO external Zoho CRM calls occurred
  assert.equal(crmCalls.createdAccounts.length, 0, 'Zero Zoho CRM accounts must be called');
  assert.equal(crmCalls.createdContacts.length, 0, 'Zero Zoho CRM contacts must be called');

  // Only the isolated temporary flow row exists
  assert.equal(db.dealerRegistrationFlows.length, 1);
  assert.equal(db.dealerRegistrationFlows[0].phone, '9876543210');
  assert.equal(db.dealerRegistrationFlows[0].phone_verified, false);
});

test('3. Verifying phone alone is insufficient to finalize registration or issue session', async () => {
  // 1. Request and verify phone OTP
  const reqRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code } = await reqRes.json();

  const verifyRes = await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: dev_code }),
  });
  const verifyData = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyData.phone_verified, true);
  assert.equal(verifyData.email_verified, false);

  // Still 0 permanent records after phone verification alone
  assert.equal(db.users.length, 0);
  assert.equal(db.dealers.length, 0);
  assert.equal(crmCalls.createdAccounts.length, 0);

  // 2. Attempt finalization with only phone verified
  const finalizeRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      business_name: 'Sunshine Kitchens',
      person_name: 'Rajesh Sharma',
      phone: '9876543210',
      email: 'owner@sunshine.com',
      gst_treatment: 'Unregistered Business',
      address: 'Shop 1, Mumbai',
    }),
  });
  const finalizeData = await finalizeRes.json();
  assert.equal(finalizeRes.status, 400);
  assert.match(finalizeData.error, /Both phone and email verification are required/i);

  // Assert no permanent records created and no CRM call
  assert.equal(db.users.length, 0);
  assert.equal(db.dealers.length, 0);
  assert.equal(crmCalls.createdAccounts.length, 0);
});

test('4. Verifying email alone is insufficient to finalize registration or issue session', async () => {
  // 1. Request and verify email OTP
  const reqRes = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@sunshine.com' }),
  });
  const { flowId, dev_code } = await reqRes.json();

  const verifyRes = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@sunshine.com', code: dev_code }),
  });
  const verifyData = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyData.email_verified, true);
  assert.equal(verifyData.phone_verified, false);

  // Still 0 permanent records after email verification alone
  assert.equal(db.users.length, 0);
  assert.equal(db.dealers.length, 0);
  assert.equal(crmCalls.createdAccounts.length, 0);

  // 2. Attempt finalization with only email verified
  const finalizeRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      business_name: 'Sunshine Kitchens',
      person_name: 'Rajesh Sharma',
      phone: '9876543210',
      email: 'owner@sunshine.com',
      gst_treatment: 'Unregistered Business',
      address: 'Shop 1, Mumbai',
    }),
  });
  const finalizeData = await finalizeRes.json();
  assert.equal(finalizeRes.status, 400);
  assert.match(finalizeData.error, /Both phone and email verification are required/i);

  assert.equal(db.users.length, 0);
  assert.equal(db.dealers.length, 0);
  assert.equal(crmCalls.createdAccounts.length, 0);
});

test('5. Wrong, expired, exhausted and abandoned OTP attempts create no permanent records and no session', async () => {
  const reqRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId } = await reqRes.json();

  // 1. Wrong OTP code
  const wrongRes = await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: '000000' }),
  });
  assert.equal(wrongRes.status, 401);
  const wrongData = await wrongRes.json();
  assert.match(wrongData.error, /Invalid verification code/i);

  // 2. Exhaust attempts (5 attempts limit)
  for (let i = 0; i < 4; i++) {
    await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId, phone: '9876543210', code: '000000' }),
    });
  }
  const exhaustedRes = await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: '000000' }),
  });
  assert.equal(exhaustedRes.status, 429);
  assert.match((await exhaustedRes.json()).error, /Too many failed verification attempts/i);

  // 3. Expired OTP
  const flow = db.dealerRegistrationFlows.find((f) => f.id === flowId);
  flow.phone_attempts = 0; // reset attempts so we specifically test expiration
  flow.phone_otp_hash = 'some-valid-hash';
  flow.phone_otp_expires_at = new Date(Date.now() - 60_000); // 1 minute in the past
  const expiredRes = await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: '123456' }),
  });
  assert.equal(expiredRes.status, 401);

  // 4. Assert zero permanent records and zero sessions
  assert.equal(db.users.length, 0);
  assert.equal(db.dealers.length, 0);
  assert.equal(db.refreshTokens.length, 0);
  assert.equal(crmCalls.createdAccounts.length, 0);
});

test('6. Finalization with missing, expired, replayed, cross-flow or mismatched verification proof is rejected', async () => {
  // Setup valid Flow A with both channels verified
  const reqResA = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId: flowA, dev_code: phoneCodeA } = await reqResA.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId: flowA, phone: '9876543210', code: phoneCodeA }),
  });

  const reqEmailA = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId: flowA, email: 'dealer-a@example.com' }),
  });
  const { dev_code: emailCodeA } = await reqEmailA.json();
  const verEmailA = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId: flowA, email: 'dealer-a@example.com', code: emailCodeA }),
  });
  const { verification_token: tokenA } = await verEmailA.json();
  assert.ok(tokenA, 'Flow A must have verification token');

  // Case A: Missing flowId
  const resMissing = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_name: 'Store A',
      phone: '9876543210',
      email: 'dealer-a@example.com',
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(resMissing.status, 400);

  // Case B: Expired flow
  const flowObjA = db.dealerRegistrationFlows.find((f) => f.id === flowA);
  flowObjA.expires_at = new Date(Date.now() - 1000);
  const resExpired = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId: flowA,
      verificationToken: tokenA,
      business_name: 'Store A',
      phone: '9876543210',
      email: 'dealer-a@example.com',
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(resExpired.status, 400);
  assert.match((await resExpired.json()).error, /Registration session has expired/i);
  const flowToRestore = db.dealerRegistrationFlows.find((f) => f.id === flowA);
  if (flowToRestore) flowToRestore.expires_at = new Date(Date.now() + 30 * 60_000); // restore

  // Case C: Cross-flow token reuse (using tokenA with a different flow B)
  const reqResB = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9811122233' }),
  });
  const { flowId: flowB } = await reqResB.json();
  const resCrossFlow = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId: flowB,
      verificationToken: tokenA, // token from Flow A!
      business_name: 'Store B',
      phone: '9811122233',
      email: 'dealer-b@example.com',
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(resCrossFlow.status, 400); // Rejected before token check or invalid verification state

  // Case D: Replayed flow (finalize once, then finalize again)
  const validFinalize = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId: flowA,
      verificationToken: tokenA,
      business_name: 'Store A',
      phone: '9876543210',
      email: 'dealer-a@example.com',
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(validFinalize.status, 201);

  // Second attempt with same flowA -> REJECTED with 409
  const replayFinalize = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId: flowA,
      verificationToken: tokenA,
      business_name: 'Store A Repeated',
      phone: '9876543210',
      email: 'dealer-a@example.com',
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(replayFinalize.status, 409);
  assert.match((await replayFinalize.json()).error, /already been completed/i);
});

test('7. Changing the phone or email after verification is rejected', async () => {
  // Start flow and verify 9876543210 & owner@sunshine.com
  const reqRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqRes.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@sunshine.com' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@sunshine.com', code: eCode }),
  });
  const { verification_token } = await verE.json();

  // Try to change phone in request-otp on already verified flow
  const changePhoneRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9811122233' }),
  });
  assert.equal(changePhoneRes.status, 400);
  assert.match((await changePhoneRes.json()).error, /Phone number cannot be changed once verified/i);

  // Try to finalize with mismatched phone
  const mismatchPhoneRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      verificationToken: verification_token,
      business_name: 'Sunshine Store',
      phone: '9811122233', // Mismatched!
      email: 'owner@sunshine.com',
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(mismatchPhoneRes.status, 400);
  assert.match((await mismatchPhoneRes.json()).error, /Submitted phone number does not match/i);

  // Try to finalize with mismatched email
  const mismatchEmailRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      verificationToken: verification_token,
      business_name: 'Sunshine Store',
      phone: '9876543210',
      email: 'attacker@evil.com', // Mismatched!
      gst_treatment: 'Unregistered Business',
    }),
  });
  assert.equal(mismatchEmailRes.status, 400);
  assert.match((await mismatchEmailRes.json()).error, /Submitted email address does not match/i);
});

test('8. Successful two-channel verification + finalization creates exactly 1 user, 1 dealer, 1 Dealer Code, issues session', async () => {
  // 1. Phone OTP
  const reqP = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqP.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  // 2. Email OTP
  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshineappliances.in' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshineappliances.in', code: eCode }),
  });
  const { verification_token } = await verE.json();

  // 3. Finalize
  const res = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      verificationToken: verification_token,
      business_name: 'Sunshine Appliances Store',
      person_name: 'Ramesh Patel',
      phone: '9876543210',
      email: 'dealer@sunshineappliances.in',
      gst_treatment: 'Registered Business - Regular',
      gst_number: '27AABCR1234D1Z5',
      address: 'Shop 12, Main Bazaar - Pune - 411001',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'pending');
  assert.ok(data.accessToken, 'Access token must be issued');
  assert.ok(data.refreshToken, 'Refresh token must be issued');
  assert.ok(data.dealer_code, 'Official Dealer Code must be generated');
  assert.match(data.dealer_code, /^DE-[A-Z]{3}-\d{4}$/, 'Dealer code must match DE-ABC-1234 format');

  // Verify DB state: exactly 1 user and 1 dealer
  assert.equal(db.users.length, 1);
  assert.equal(db.dealers.length, 1);
  const user = db.users[0];
  const dealer = db.dealers[0];
  assert.equal(user.role, 'dealer');
  assert.equal(user.status, 'pending');
  assert.equal(user.email_verified, true);
  assert.equal(user.phone_verified, true);
  assert.equal(user.dealer_id, dealer.id);
  assert.equal(dealer.owner_user_id, user.id);
  assert.equal(dealer.status, 'pending');
  assert.equal(dealer.dealer_code, data.dealer_code);

  // Flow is consumed
  const flow = db.dealerRegistrationFlows.find((f) => f.id === flowId);
  assert.ok(flow.consumed_at, 'Flow must be marked consumed');

  // Zoho CRM Account and Contact provisioning occurred
  assert.equal(crmCalls.createdAccounts.length, 1);
  assert.equal(crmCalls.createdContacts.length, 1);
  assert.equal(crmCalls.createdAccounts[0].dealerCode, data.dealer_code);
  assert.equal(crmCalls.createdContacts[0].portalRole, 'Owner');
});

test('9. A database failure rolls back the internal writes and does not trigger CRM', async () => {
  // Complete verification
  const reqP = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqP.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshine.in' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshine.in', code: eCode }),
  });
  const { verification_token } = await verE.json();

  // Simulate Database Error during dealer insert
  dbFailOnInsertDealer = true;

  const finalizeRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      verificationToken: verification_token,
      business_name: 'Sunshine Appliances Store',
      phone: '9876543210',
      email: 'dealer@sunshine.in',
      gst_treatment: 'Unregistered Business',
    }),
  });

  assert.equal(finalizeRes.status, 500);

  // Transaction rolled back: ZERO users, ZERO dealers
  assert.equal(db.users.length, 0, 'Rolled back: user must not exist');
  assert.equal(db.dealers.length, 0, 'Rolled back: dealer must not exist');
  assert.equal(db.refreshTokens.length, 0, 'No session must be issued');

  // Flow was rolled back
  const flow = db.dealerRegistrationFlows.find((f) => f.id === flowId);
  assert.equal(flow.consumed_at, null, 'Flow consumption rolled back');

  // CRITICAL: CRM was NEVER called
  assert.equal(crmCalls.createdAccounts.length, 0, 'CRM must never be called on DB rollback');
  assert.equal(crmCalls.createdContacts.length, 0, 'CRM must never be called on DB rollback');
});

test('10. A CRM failure after commit preserves the application and is recoverable by the existing retry mechanism', async () => {
  // Complete verification
  const reqP = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqP.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshine.in' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshine.in', code: eCode }),
  });
  const { verification_token } = await verE.json();

  // Simulate CRM Outage (e.g. Zoho rate limit or 503)
  crmCalls.failAccountCreate = true;

  const finalizeRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flowId,
      verificationToken: verification_token,
      business_name: 'Sunshine Appliances Store',
      phone: '9876543210',
      email: 'dealer@sunshine.in',
      gst_treatment: 'Unregistered Business',
    }),
  });

  // DB transaction committed successfully: user gets 201 response and valid session
  assert.equal(finalizeRes.status, 201);
  const data = await finalizeRes.json();
  assert.ok(data.accessToken);
  assert.equal(data.status, 'pending');

  // Application preserved in DB with zoho_account_id = null
  assert.equal(db.users.length, 1);
  assert.equal(db.dealers.length, 1);
  const dealer = db.dealers[0];
  assert.equal(dealer.status, 'pending');
  assert.equal(dealer.zoho_account_id, null);

  // Now CRM recovers
  crmCalls.failAccountCreate = false;

  // Run crmPoll job
  await crmPoll();

  // crmPoll successfully recovered and provisioned Account & Contact
  assert.ok(dealer.zoho_account_id, 'Dealer zoho_account_id must be populated by crmPoll');
  assert.ok(db.users[0].zoho_contact_id, 'User zoho_contact_id must be populated by crmPoll');
});

test('11. Repeating finalization cannot create another user/dealer application or repeat unsafe provisioning', async () => {
  // Complete verification
  const reqP = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqP.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshine.in' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'dealer@sunshine.in', code: eCode }),
  });
  const { verification_token } = await verE.json();

  const payload = {
    flowId,
    verificationToken: verification_token,
    business_name: 'Sunshine Appliances Store',
    phone: '9876543210',
    email: 'dealer@sunshine.in',
    gst_treatment: 'Unregistered Business',
  };

  // First call -> 201
  const first = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201);
  assert.equal(db.users.length, 1);
  assert.equal(db.dealers.length, 1);
  assert.equal(crmCalls.createdAccounts.length, 1);

  // Second repeated call -> 409 Conflict
  const second = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(second.status, 409);

  // Third repeated call -> 409 Conflict
  const third = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(third.status, 409);

  // Exact counts unchanged
  assert.equal(db.users.length, 1, 'Exactly one user exists');
  assert.equal(db.dealers.length, 1, 'Exactly one dealer exists');
  assert.equal(crmCalls.createdAccounts.length, 1, 'Exactly one CRM account was created');
});

test('12. Contact cooldown: Second request to same phone inside cooldown is rejected (even with new flow ID or different IP/endpoint)', async () => {
  // 1. First OTP request to 9876543210 -> 200 OK
  const res1 = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.1.1.1' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.ok, true);
  assert.ok(data1.flowId);

  // 2. Immediate second request with same flow ID -> 429
  const res2 = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.1.1.1' },
    body: JSON.stringify({ flowId: data1.flowId, phone: '9876543210' }),
  });
  assert.equal(res2.status, 429);
  const data2 = await res2.json();
  assert.match(data2.error, /Please wait \d+ seconds before requesting another verification code/i);

  // 3. Immediate request with NEW flow ID (attempting cooldown bypass) -> 429
  const res3 = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '2.2.2.2' }, // different IP!
    body: JSON.stringify({ phone: '9876543210' }), // no flowId passed!
  });
  assert.equal(res3.status, 429);
  assert.match((await res3.json()).error, /Please wait \d+ seconds/i);

  // 4. Immediate request via UNIFIED endpoint variant -> 429
  const res4 = await fetch(`${baseUrl}/api/dealers/register/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '3.3.3.3' }, // yet another IP
    body: JSON.stringify({ channel: 'phone', phone: '+91 98765 43210' }), // with country code
  });
  assert.equal(res4.status, 429);

  // Assert NO extra flows were created in db
  assert.equal(db.dealerRegistrationFlows.length, 1, 'No new flows created for rate-limited requests');
});

test('13. Contact cooldown: Second request to same email inside cooldown is rejected across flows, IPs, and endpoints', async () => {
  // 1. First OTP request to dealer@example.com -> 200 OK
  const res1 = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
    body: JSON.stringify({ email: 'Dealer@Example.com' }),
  });
  assert.equal(res1.status, 200);
  const data1 = await res1.json();

  // 2. Immediate second request on same flow -> 429
  const res2 = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1' },
    body: JSON.stringify({ flowId: data1.flowId, email: 'dealer@example.com' }),
  });
  assert.equal(res2.status, 429);

  // 3. Immediate third request with new flow ID and different IP -> 429
  const res3 = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.2' },
    body: JSON.stringify({ email: 'dealer@example.com' }),
  });
  assert.equal(res3.status, 429);

  // 4. Unified endpoint with uppercase/whitespace normalization -> 429
  const res4 = await fetch(`${baseUrl}/api/dealers/register/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.3' },
    body: JSON.stringify({ channel: 'email', email: '  DEALER@example.com  ' }),
  });
  assert.equal(res4.status, 429);
});

test('14. Different recipients proceed independently without cross-blocking', async () => {
  // Recipient A (phone)
  const resA = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(resA.status, 200);

  // Recipient B (different phone) -> NOT blocked
  const resB = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9811122233' }),
  });
  assert.equal(resB.status, 200);

  // Recipient C (email) -> NOT blocked by phone cooldown
  const resC = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.com' }),
  });
  assert.equal(resC.status, 200);

  // Recipient D (different email) -> NOT blocked
  const resD = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bob@example.com' }),
  });
  assert.equal(resD.status, 200);
});

test('15. Concurrent requests cannot send duplicate OTPs to the same recipient inside cooldown', async () => {
  sentOtps.whatsapp = [];
  const reqBody = JSON.stringify({ phone: '9876543210' });
  const headers = { 'Content-Type': 'application/json' };

  // Dispatch 3 concurrent requests at the exact same time
  const results = await Promise.all([
    fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, { method: 'POST', headers, body: reqBody }),
    fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, { method: 'POST', headers, body: reqBody }),
    fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, { method: 'POST', headers, body: reqBody }),
  ]);

  const statuses = results.map((r) => r.status);
  const successCount = statuses.filter((s) => s === 200).length;
  const limitedCount = statuses.filter((s) => s === 429).length;

  assert.equal(successCount, 1, 'Exactly one concurrent request must succeed');
  assert.equal(limitedCount, 2, 'Other concurrent requests must be rejected with 429');
  assert.equal(sentOtps.whatsapp.length, 1, 'Only 1 WhatsApp OTP message was dispatched');
});

test('16. Provider failure releases contact cooldown for immediate recovery; elapsed cooldown permits resend', async () => {
  // Simulate WhatsApp failure
  sentOtps.failWhatsApp = true;

  try {
    const failRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' }),
    });
    assert.equal(failRes.status, 500);

    // Cooldown was released on failure! Immediate retry should succeed once provider recovers
    sentOtps.failWhatsApp = false;

    const retryRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' }),
    });
    assert.equal(retryRes.status, 200, 'Immediate retry after provider error must succeed');

    // Simulate elapsed cooldown (61 seconds in the past)
    const cooldownEntry = db.dealerOtpCooldowns.get('phone:9876543210');
    assert.ok(cooldownEntry);
    db.dealerOtpCooldowns.set('phone:9876543210', new Date(Date.now() - 61_000));

    const resendRes = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' }),
    });
    assert.equal(resendRes.status, 200, 'Allowed resend after cooldown expires must succeed');
  } finally {
    sentOtps.failWhatsApp = false;
  }
});

test('17. Verification token is stored as SHA-256 hash in database; raw token is not stored in plaintext', async () => {
  // 1. Phone OTP
  const reqP = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqP.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  // 2. Email OTP
  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@securestore.com' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@securestore.com', code: eCode }),
  });
  const verData = await verE.json();
  assert.equal(verData.both_verified, true);
  assert.ok(verData.verification_token, 'Client receives raw token upon verification');
  const rawToken = verData.verification_token;
  assert.equal(typeof rawToken, 'string');
  assert.equal(rawToken.length, 64, 'Raw token is 64 hex characters (32 bytes)');

  // 3. Inspect PostgreSQL stored state in flow
  const storedFlow = db.dealerRegistrationFlows.find((f) => f.id === flowId);
  assert.ok(storedFlow, 'Flow exists in db');
  assert.equal(storedFlow.verification_token, undefined, 'Raw plaintext verification_token must NOT exist in DB');
  assert.ok(storedFlow.verification_token_hash, 'verification_token_hash must exist in DB');

  // Verify the stored value is the SHA-256 hash of the raw token
  const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.equal(storedFlow.verification_token_hash, expectedHash, 'Stored hash matches SHA-256 of raw token');
  assert.notEqual(storedFlow.verification_token_hash, rawToken, 'Stored hash must differ from raw token');
});

test('18. Finalization validates SHA-256 token hash; incorrect token is rejected and valid token creates records atomically', async () => {
  // 1. Phone + Email verification
  const reqP = await fetch(`${baseUrl}/api/dealers/register/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  const { flowId, dev_code: pCode } = await reqP.json();
  await fetch(`${baseUrl}/api/dealers/register/phone/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, phone: '9876543210', code: pCode }),
  });

  const reqE = await fetch(`${baseUrl}/api/dealers/register/email/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@appliances.com' }),
  });
  const { dev_code: eCode } = await reqE.json();
  const verE = await fetch(`${baseUrl}/api/dealers/register/email/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, email: 'owner@appliances.com', code: eCode }),
  });
  const { verification_token } = await verE.json();

  const basePayload = {
    flowId,
    business_name: 'Super Appliance Hub',
    person_name: 'Anand Kumar',
    phone: '9876543210',
    email: 'owner@appliances.com',
    gst_treatment: 'Unregistered Business',
  };

  // Case A: Tampered / Incorrect token -> 401
  const tamperedToken = verification_token.slice(0, -1) + (verification_token.endsWith('a') ? 'b' : 'a');
  const badTokenRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...basePayload, verificationToken: tamperedToken }),
  });
  assert.equal(badTokenRes.status, 401);
  assert.match((await badTokenRes.json()).error, /Invalid or mismatched verification token/i);

  // Assert NO user or dealer was created on invalid token
  assert.equal(db.users.length, 0);
  assert.equal(db.dealers.length, 0);

  // Case B: Correct token -> 201 Created
  const goodTokenRes = await fetch(`${baseUrl}/api/dealers/register/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...basePayload, verificationToken: verification_token }),
  });
  assert.equal(goodTokenRes.status, 201);
  assert.equal(db.users.length, 1);
  assert.equal(db.dealers.length, 1);

  // Flow marked consumed
  const flow = db.dealerRegistrationFlows.find((f) => f.id === flowId);
  assert.ok(flow.consumed_at);
});

