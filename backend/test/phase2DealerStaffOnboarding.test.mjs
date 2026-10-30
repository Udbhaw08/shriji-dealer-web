import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sha256, hashPassword, formatLoginCode, hashOtp, verifyOtpHash } from '../src/utils/hash.js';
import { generateUniqueDealerCode } from '../src/utils/loginCode.js';

// Setup test env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase2-onboarding';
process.env.ENABLE_DEV_OTP = 'true';

const testEnv = {
  jwtSecret: 'test-jwt-secret-phase2-onboarding',
  googleClientId: 'test-google-client-id',
  enableDevOtp: 'true',
  whatsapp: { token: 't', phoneId: 'p', templateName: 'otp', templateLang: 'en_US', graphApiVersion: 'v21.0', templateHasButton: true },
  zoho: {
    dc: 'in',
    crm: { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
    commerce: { accountNumber: '1', clientId: 'c', clientSecret: 's', refreshToken: 'r' },
  },
};

// In-memory test state
const db = {
  users: [],
  dealers: [],
  staffInvites: [],
  otpCodes: [],
  refreshTokens: [],
  auditLog: [],
  dealerRegistrationFlows: [],
};

let nextId = 2000;
function resetDb() {
  db.users = [];
  db.dealers = [];
  db.staffInvites = [];
  db.otpCodes = [];
  db.refreshTokens = [];
  db.auditLog = [];
  db.dealerRegistrationFlows = [];
  nextId = 2000;
}

const crmCalls = {
  createdAccounts: [],
  createdContacts: [],
  linkedContacts: [],
  updatedContacts: [],
};

function resetCrmCalls() {
  crmCalls.createdAccounts = [];
  crmCalls.createdContacts = [];
  crmCalls.linkedContacts = [];
  crmCalls.updatedContacts = [];
}

// In-memory SQL tag handler
function mockSql(strings, ...values) {
  const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), '');
  const qLower = query.toLowerCase();

  // AUDIT LOG
  if (qLower.includes('insert into audit_log')) {
    db.auditLog.push({ userId: values[0], action: values[1], entityType: values[2], entityId: values[3] });
    return Promise.resolve([]);
  }

  // SELECT ... FROM dealers
  if (qLower.includes('from dealers')) {
    let matches = [...db.dealers];
    if (query.includes('lower(dealer_code) = lower(')) {
      const codeVal = values[0];
      const fmtVal = values[1] || codeVal;
      matches = matches.filter(
        (d) =>
          d.dealer_code &&
          (d.dealer_code.toLowerCase() === String(codeVal).toLowerCase() ||
            d.dealer_code.toLowerCase() === String(fmtVal).toLowerCase())
      );
    }
    if (query.includes("status = 'approved'")) {
      matches = matches.filter((d) => d.status === 'approved');
    }
    if (query.includes('owner_user_id =')) {
      const uId = values[0];
      matches = matches.filter((d) => d.owner_user_id === uId);
    }
    if (query.includes('where id =')) {
      const dId = values[0];
      matches = matches.filter((d) => d.id === dId);
    }
    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // INSERT INTO dealers
  if (qLower.includes('insert into dealers')) {
    const newDealer = {
      id: `dealer-${nextId++}`,
      owner_user_id: values[0],
      business_name: values[1],
      gst_number: values[2],
      gst_treatment: values[3],
      address: values[4],
      status: 'pending',
      dealer_code: values[5] || `DE-TEST-${nextId}`,
      staff_limit: 10,
      created_at: new Date(),
    };
    db.dealers.push(newDealer);
    return Promise.resolve([newDealer]);
  }

  // UPDATE dealers
  if (qLower.includes('update dealers set')) {
    const dId = values[values.length - 1];
    const dealer = db.dealers.find((d) => d.id === dId);
    if (dealer) {
      const statusVal = values.find((v) => ['approved', 'rejected', 'revoked', 'pending'].includes(v));
      if (statusVal) dealer.status = statusVal;
      const accVal = values.find((v) => typeof v === 'string' && v.startsWith('zoho-acc-'));
      if (accVal) dealer.zoho_account_id = accVal;
    }
    return Promise.resolve(dealer ? [dealer] : []);
  }

  // SELECT ... FROM staff_invites
  if (qLower.includes('from staff_invites')) {
    let matches = [...db.staffInvites];
    if (query.includes('si.code_hash =')) {
      const hash1 = values[0];
      const hash2 = values[1];
      matches = matches.filter((si) => si.code_hash === hash1 || si.code_hash === hash2);
    }
    if (query.includes('revoked = false')) matches = matches.filter((si) => !si.revoked);
    if (query.includes('used_by is null')) matches = matches.filter((si) => !si.used_by);
    if (query.includes('expires_at > now()')) matches = matches.filter((si) => new Date(si.expires_at) > new Date());

    // Join dealer info
    const joined = matches.map((si) => {
      const d = db.dealers.find((dlr) => dlr.id === si.dealer_id) || {};
      return { ...si, business_name: d.business_name, dealer_code: d.dealer_code };
    });
    if (query.includes('limit 1')) return Promise.resolve(joined.slice(0, 1));
    return Promise.resolve(joined);
  }

  // UPDATE staff_invites
  if (qLower.includes('update staff_invites set used_by =')) {
    const usedBy = values[0];
    const id = values[1];
    const invite = db.staffInvites.find((i) => i.id === id);
    if (invite) {
      invite.used_by = usedBy;
      invite.used_at = new Date();
    }
    return Promise.resolve(invite ? [invite] : []);
  }

  // SELECT COUNT FROM users (staff limit check)
  if (qLower.includes('select count(*)::int as n from users')) {
    const dealerId = values[0];
    const count = db.users.filter((u) => u.dealer_id === dealerId && u.role === 'dealer_staff' && ['active', 'pending'].includes(u.status)).length;
    return Promise.resolve([{ n: count }]);
  }

  // SELECT ... FROM users
  if (qLower.includes('from users')) {
    let matches = [...db.users];
    if (query.includes('lower(email) =')) {
      const email = values[0];
      matches = matches.filter((u) => u.email && u.email.toLowerCase() === String(email).toLowerCase());
    }
    if (query.includes('phone =')) {
      const phone = values[0];
      matches = matches.filter((u) => u.phone === phone);
    }
    if (query.includes('id !=') && query.includes('phone =')) {
      const phone = values[0];
      const excId = values[1];
      matches = matches.filter((u) => u.id !== excId && u.phone === phone);
    }
    if (query.includes('where id =') || query.includes('where u.id =')) {
      const id = values[0];
      matches = matches.filter((u) => u.id === id);
    }
    if (query.includes('limit 1')) return Promise.resolve(matches.slice(0, 1));
    return Promise.resolve(matches);
  }

  // INSERT INTO users (staff signup)
  if (qLower.includes('insert into users')) {
    let newUser;
    if (query.includes('email, phone, password_hash')) {
      newUser = {
        id: `user-${nextId++}`,
        email: values[0],
        phone: values[1],
        password_hash: values[2],
        full_name: values[3],
        role: 'dealer_staff',
        status: 'pending',
        dealer_id: values[4],
        email_verified: true,
        phone_verified: true,
        can_see_dealer_price: true,
        created_at: new Date(),
      };
    } else if (query.includes('email, password_hash')) {
      newUser = {
        id: `user-${nextId++}`,
        email: values[0],
        phone: null,
        password_hash: values[1],
        full_name: values[2],
        role: 'dealer_staff',
        status: 'pending',
        dealer_id: values[3],
        email_verified: false,
        phone_verified: false,
        can_see_dealer_price: true,
        created_at: new Date(),
      };
    }
    if (newUser) db.users.push(newUser);
    return Promise.resolve(newUser ? [newUser] : []);
  }

  // DEALER REGISTRATION FLOWS — SELECT
  if (qLower.includes('from dealer_registration_flows')) {
    let matches = [...(db.dealerRegistrationFlows || [])];
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
    if (query.includes('set consumed_at = now()')) {
      const id = values[0];
      const flow = (db.dealerRegistrationFlows || []).find((f) => f.id === id && !f.consumed_at);
      if (flow) flow.consumed_at = new Date();
      return Promise.resolve(flow ? [flow] : []);
    }
  }

  // UPDATE users
  if (qLower.includes('update users set')) {
    const idVal = values[values.length - 1];
    const user = db.users.find((u) => u.id === idVal);
    if (user) {
      if (query.includes("role = 'dealer'")) user.role = 'dealer';
      if (query.includes("status = 'pending'")) user.status = 'pending';
      if (query.includes("status = 'active'")) user.status = 'active';
      if (query.includes('status =')) {
        const sVal = values.find((v) => ['active', 'pending', 'rejected', 'revoked'].includes(v));
        if (sVal) user.status = sVal;
      }
      if (query.includes('dealer_id =')) user.dealer_id = values[0] || user.dealer_id;
      if (query.includes('zoho_contact_id =')) user.zoho_contact_id = values[0] || user.zoho_contact_id;
    }
    return Promise.resolve(user ? [user] : []);
  }

  // REFRESH TOKENS
  if (qLower.includes('insert into refresh_tokens')) {
    db.refreshTokens.push({ id: `rt-${nextId++}`, token_hash: values[0], user_id: values[1], revoked: false });
    return Promise.resolve([]);
  }
  if (qLower.includes('update refresh_tokens set revoked = true')) {
    const uId = values[0];
    db.refreshTokens.forEach((rt) => { if (rt.user_id === uId) rt.revoked = true; });
    return Promise.resolve([]);
  }

  return Promise.resolve([]);
}

mockSql.begin = async (callback) => callback(mockSql);

// Mock CRM Client
const mockCrm = {
  isCrmConfigured: () => true,
  createDealerAccount: async (payload) => {
    crmCalls.createdAccounts.push(payload);
    return `zoho-acc-${nextId++}`;
  },
  createDealerContact: async (payload) => {
    crmCalls.createdContacts.push(payload);
    return `zoho-con-${nextId++}`;
  },
  linkContactToBackendUser: async (contactId, userId) => {
    crmCalls.linkedContacts.push({ contactId, userId });
    return true;
  },
  updateContactDetails: async (contactId, payload) => {
    crmCalls.updatedContacts.push({ contactId, payload });
    return true;
  },
  getDealerAccount: async (accId) => ({
    zohoAccountId: accId,
    dealerStatus: 'Pending',
    businessName: 'Mock Business',
  }),
  getPrimaryContactForAccount: async () => null,
  syncAccountUserSourceToContacts: async () => true,
  findOwnerContactInAccount: async () => null,
  deactivateAccountInCrm: async () => true,
  deactivateContactInCrm: async () => true,
};

// Setup Express test app with mocked dependencies
mock.module('../src/config/env.js', { namedExports: { env: testEnv } });
mock.module('../src/db/pool.js', { namedExports: { sql: mockSql } });
mock.module('../src/services/crmClient.js', { namedExports: mockCrm });
mock.module('../src/services/notifications.js', {
  namedExports: {
    sendEmailOtp: async () => ({ ok: true }),
    sendWhatsAppOtp: async () => ({ ok: true }),
    notify: async () => ({ ok: true }),
  },
});

const { signAccessToken } = await import('../src/services/tokens.js');
const { authRouter } = await import('../src/routes/auth.js');
const { dealersRouter } = await import('../src/routes/dealers.js');
const { applyCrmAccountState } = await import('../src/services/dealerApp.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/dealers', dealersRouter);
app.use(errorHandler);

let server;
let baseUrl;

beforeEach(async () => {
  resetDb();
  resetCrmCalls();
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

function authHeader(user) {
  const token = signAccessToken(user);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ============================================================================
// PHASE 2 TESTS
// ============================================================================

// 1. Dealer Application Form Validation & Gating
test('POST /api/dealers/apply rejects unauthenticated requests with 401', async () => {
  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_name: 'Shop 1' }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/dealers/apply rejects short/missing business name with 400', async () => {
  const user = { id: 'u1', email: 'v@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ business_name: 'A' }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Business \/ Shop name is required/);
});

test('POST /api/dealers/apply rejects registered GST treatment without valid 15-char GSTIN', async () => {
  const user = { id: 'u1', email: 'v@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({
      business_name: 'Shriji Appliance World',
      gst_treatment: 'Registered Business - Regular',
      gst_number: 'INVALID_GST',
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Please enter a valid 15-character GSTIN/);
});

test('POST /api/dealers/apply rejects composition GST treatment without valid 15-char GSTIN', async () => {
  const user = { id: 'u1-comp', email: 'comp@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({
      business_name: 'Shriji Composite Store',
      gst_treatment: 'Registered Business - Composition',
      gst_number: '',
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Please enter a valid 15-character GSTIN/);
});

test('POST /api/dealers/apply allows Unregistered Business without GSTIN and sets gst_number to null', async () => {
  const user = { id: 'u-unreg', email: 'unreg@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({
      business_name: 'Shriji Local Mart',
      gst_treatment: 'Unregistered Business',
      gst_number: 'LEAKED_GST_NUMBER', // Should be purged/ignored for unregistered business
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);

  const created = db.dealers.find((d) => d.id === data.dealer_id);
  assert.ok(created);
  assert.equal(created.gst_treatment, 'Unregistered Business');
  assert.equal(created.gst_number, null);
});

test('POST /api/dealers/apply allows Consumer without GSTIN', async () => {
  const user = { id: 'u-consumer', email: 'consumer@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({
      business_name: 'Individual Retailer',
      gst_treatment: 'Consumer',
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);

  const created = db.dealers.find((d) => d.id === data.dealer_id);
  assert.ok(created);
  assert.equal(created.gst_treatment, 'Consumer');
  assert.equal(created.gst_number, null);
});

test('POST /api/dealers/apply enforces email and phone verification gate', async () => {
  // Missing email verification
  const uNoEmail = { id: 'u-no-email', email: 'noemail@example.com', email_verified: false, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(uNoEmail);
  const res1 = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(uNoEmail),
    body: JSON.stringify({ business_name: 'Store A' }),
  });
  assert.equal(res1.status, 403);
  const data1 = await res1.json();
  assert.match(data1.error, /Email verification is required/);

  // Missing phone verification
  const uNoPhone = { id: 'u-no-phone', email: 'hasemail@example.com', email_verified: true, phone: '9876543210', phone_verified: false, role: 'customer', status: 'active' };
  db.users.push(uNoPhone);
  const res2 = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(uNoPhone),
    body: JSON.stringify({ business_name: 'Store B' }),
  });
  assert.equal(res2.status, 403);
  const data2 = await res2.json();
  assert.match(data2.error, /Phone verification via WhatsApp OTP is required/);
});

test('POST /api/dealers/apply succeeds for fully verified applicant, creates CRM Account & Contact', async () => {
  const user = {
    id: 'u-verified-applicant',
    email: 'dealer.owner@sunshinedealer.com',
    email_verified: true,
    phone: '9876543210',
    phone_verified: true,
    role: 'customer',
    status: 'active',
    full_name: 'Mahesh Patel',
  };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({
      business_name: 'Sunshine Electricals & Appliances',
      gst_treatment: 'Registered Business - Regular',
      gst_number: '27AABCS1429B1ZB',
      address: 'Shop 12, Main Market, Pune - 411001',
      person_name: 'Mahesh Patel',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'pending');
  assert.ok(data.dealer_id);

  // Verify DB dealer record created
  const dealer = db.dealers.find((d) => d.id === data.dealer_id);
  assert.ok(dealer);
  assert.equal(dealer.business_name, 'Sunshine Electricals & Appliances');
  assert.equal(dealer.status, 'pending');
  assert.match(dealer.dealer_code, /^DE-[A-Z]{3}-\d{4}$/);

  // Verify CRM Account and Contact payloads
  assert.equal(crmCalls.createdAccounts.length, 1);
  assert.equal(crmCalls.createdAccounts[0].businessName, 'Sunshine Electricals & Appliances');
  assert.equal(crmCalls.createdAccounts[0].gstNumber, '27AABCS1429B1ZB');
  assert.equal(crmCalls.createdAccounts[0].phone, '9876543210');

  assert.equal(crmCalls.createdContacts.length, 1);
  assert.equal(crmCalls.createdContacts[0].personName, 'Mahesh Patel');
  assert.equal(crmCalls.createdContacts[0].portalRole, 'Owner');
  assert.equal(crmCalls.linkedContacts.length, 1);
  assert.equal(crmCalls.linkedContacts[0].userId, user.id);
});

test('POST /api/dealers/apply rejects duplicate submissions with 409', async () => {
  const user = {
    id: 'u-existing-dealer',
    email: 'existing@sunshinedealer.com',
    email_verified: true,
    phone: '9876543210',
    phone_verified: true,
    role: 'dealer',
    status: 'pending',
  };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ business_name: 'Duplicate Store' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.error, /dealer application already exists/);
});

// 2. Staff Code Lookup & Registration
test('POST /api/auth/staff/lookup-code rejects missing code with 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/staff/lookup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: '' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/auth/staff/lookup-code rejects unrecognized code with 404', async () => {
  const res = await fetch(`${baseUrl}/api/auth/staff/lookup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'DE-NON-EXIST' }),
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.match(data.error, /Invalid or unrecognized Dealer \/ Business Code/);
});

test('POST /api/auth/staff/lookup-code matches approved Dealer Code with case and format insensitivity', async () => {
  db.dealers.push({
    id: 'dealer-123',
    business_name: 'Metro Kitchens & Home',
    dealer_code: 'DE-BKV-8180',
    status: 'approved',
  });

  // Test lowercase input without hyphen
  const res = await fetch(`${baseUrl}/api/auth/staff/lookup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'debkv8180' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.type, 'dealer_code');
  assert.equal(data.business_name, 'Metro Kitchens & Home');
  assert.equal(data.dealer_code, 'DE-BKV-8180');
});

test('POST /api/auth/staff/lookup-code matches active staff invite code', async () => {
  const rawCode = 'RJA-7K29';
  const dealerId = 'dealer-777';
  db.dealers.push({
    id: dealerId,
    business_name: 'Sunshine Pune Hub',
    dealer_code: 'DE-PUN-9922',
    status: 'approved',
  });
  db.staffInvites.push({
    id: 'invite-1',
    dealer_id: dealerId,
    code_hash: sha256(rawCode),
    revoked: false,
    used_by: null,
    expires_at: new Date(Date.now() + 24 * 3600 * 1000),
  });

  const res = await fetch(`${baseUrl}/api/auth/staff/lookup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: rawCode }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.type, 'invite_code');
  assert.equal(data.business_name, 'Sunshine Pune Hub');
  assert.equal(data.dealer_code, 'DE-PUN-9922');
});

test('POST /api/auth/staff/signup rejects unverified registration without flowId and verificationToken with 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/staff/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealer_code: 'DE-MOD-5544',
      email: 'unverified@example.com',
      phone: '9822334455',
      password: 'SecurePassword123!',
      full_name: 'Anand Verma',
    }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /Two-channel verification .* required/);
});

test('POST /api/auth/staff/signup validates input and registers pending staff member after two-channel verification', async () => {
  const dealerId = 'dealer-reg-1';
  db.dealers.push({
    id: dealerId,
    business_name: 'Modern Stores',
    dealer_code: 'DE-MOD-5544',
    status: 'approved',
    staff_limit: 5,
    owner_user_id: 'owner-1',
    zoho_account_id: 'acc-mod-1',
  });
  db.users.push({
    id: 'owner-1',
    full_name: 'Store Owner',
    email: 'owner@modernstores.com',
    role: 'dealer',
    status: 'approved',
    zoho_contact_id: 'cnt-owner-1',
  });

  const rawToken = 'test-verification-token-staff-12345';
  const tokenHash = sha256(rawToken);
  const flowId = 'flow-staff-verified-1';

  db.dealerRegistrationFlows.push({
    id: flowId,
    phone: '9822334455',
    phone_verified: true,
    email: 'staff.member@modernstores.com',
    email_verified: true,
    verification_token_hash: tokenHash,
    expires_at: new Date(Date.now() + 30 * 60_000),
    consumed_at: null,
  });

  const res = await fetch(`${baseUrl}/api/auth/staff/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealer_code: 'DE-MOD-5544',
      email: 'staff.member@modernstores.com',
      phone: '9822334455',
      password: 'SecurePassword123!',
      full_name: 'Anand Verma',
      flowId,
      verificationToken: rawToken,
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'pending');
  assert.ok(data.accessToken);

  // Verify staff user in DB
  const createdStaff = db.users.find((u) => u.email === 'staff.member@modernstores.com');
  assert.ok(createdStaff);
  assert.equal(createdStaff.role, 'dealer_staff');
  assert.equal(createdStaff.status, 'pending');
  assert.equal(createdStaff.dealer_id, dealerId);
  assert.equal(createdStaff.phone, '9822334455');
  assert.equal(createdStaff.phone_verified, true);
  assert.equal(createdStaff.email_verified, true);
  assert.equal(createdStaff.full_name, 'Anand Verma');

  // Verify flow is marked consumed
  const flow = db.dealerRegistrationFlows.find((f) => f.id === flowId);
  assert.ok(flow.consumed_at);

  // Verify Zoho CRM Contact created for staff
  const staffContact = crmCalls.createdContacts.find((c) => c.email === 'staff.member@modernstores.com');
  assert.ok(staffContact);
  assert.equal(staffContact.portalRole, 'Staff');
  assert.equal(staffContact.userSource, 'ReStor Dealer Staff');
  assert.equal(staffContact.accountId, 'acc-mod-1');
  assert.equal(staffContact.reportingToContactId, 'cnt-owner-1');
});

test('POST /api/auth/staff/signup rejects duplicate phone number with 409', async () => {
  db.dealers.push({
    id: 'dealer-dup-phone',
    business_name: 'Apex Appliances',
    dealer_code: 'DE-APX-1122',
    status: 'approved',
    staff_limit: 5,
  });

  // Existing user has this phone
  db.users.push({
    id: 'existing-phone-user',
    email: 'other@example.com',
    phone: '9988776655',
    role: 'customer',
    status: 'active',
  });

  const rawToken = 'test-token-dup-phone';
  const flowId = 'flow-dup-phone';
  db.dealerRegistrationFlows.push({
    id: flowId,
    phone: '9988776655',
    phone_verified: true,
    email: 'newstaff@apex.com',
    email_verified: true,
    verification_token_hash: sha256(rawToken),
    expires_at: new Date(Date.now() + 30 * 60_000),
    consumed_at: null,
  });

  const res = await fetch(`${baseUrl}/api/auth/staff/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealer_code: 'DE-APX-1122',
      email: 'newstaff@apex.com',
      phone: '9988776655',
      password: 'Password123!',
      full_name: 'Vijay Kale',
      flowId,
      verificationToken: rawToken,
    }),
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.error, /An account with this phone number is already registered/);
});

// 3. Status Convergence & CRM Reconciliation
test('applyCrmAccountState synchronizes approved status and generates dealer code if needed', async () => {
  const dealer = {
    id: 'dlr-conv-1',
    business_name: 'Conv Shop',
    status: 'pending',
    dealer_code: null,
    owner_user_id: 'user-conv-owner',
  };
  db.dealers.push(dealer);
  db.users.push({ id: 'user-conv-owner', role: 'dealer', status: 'pending' });

  const crmAccount = {
    zohoAccountId: 'zoho-acc-conv-1',
    dealerStatus: 'Approved',
    businessName: 'Conv Shop Verified',
    dealerCode: 'DE-CON-8899',
    priceList: 'MH Dist Premium Oct 2026',
  };

  const changed = await applyCrmAccountState(dealer, crmAccount);
  assert.equal(changed, true);

  const updatedDealer = db.dealers.find((d) => d.id === dealer.id);
  assert.equal(updatedDealer.status, 'approved');

  const updatedOwner = db.users.find((u) => u.id === dealer.owner_user_id);
  assert.equal(updatedOwner.status, 'active');
});

test('applyCrmAccountState synchronizes rejected status and revokes sessions', async () => {
  const dealer = {
    id: 'dlr-rej-1',
    business_name: 'Rejected Shop',
    status: 'pending',
    owner_user_id: 'user-rej-owner',
  };
  db.dealers.push(dealer);
  db.users.push({ id: 'user-rej-owner', role: 'dealer', status: 'pending' });
  db.refreshTokens.push({ id: 'rt-1', user_id: 'user-rej-owner', revoked: false });

  const crmAccount = {
    zohoAccountId: 'zoho-acc-rej-1',
    dealerStatus: 'Rejected',
    rejectReason: 'Invalid GST Registration Certificate',
  };

  const changed = await applyCrmAccountState(dealer, crmAccount);
  assert.equal(changed, true);

  const updatedDealer = db.dealers.find((d) => d.id === dealer.id);
  assert.equal(updatedDealer.status, 'rejected');

  const updatedOwner = db.users.find((u) => u.id === dealer.owner_user_id);
  assert.equal(updatedOwner.status, 'rejected');

  // Verify tokens were revoked
  const rt = db.refreshTokens.find((t) => t.user_id === 'user-rej-owner');
  assert.equal(rt.revoked, true);
});
