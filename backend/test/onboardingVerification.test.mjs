import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sha256, hashOtp, verifyOtpHash } from '../src/utils/hash.js';

// Setup test env variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-onboarding-phase1';
process.env.ENABLE_DEV_OTP = 'true';

const testEnv = {
  jwtSecret: 'test-jwt-secret-onboarding-phase1',
  googleClientId: 'test-google-client-id',
  enableDevOtp: 'true',
  whatsapp: {
    token: 'test-meta-token',
    phoneId: 'test-phone-id',
    templateName: 'otp',
    templateLang: 'en_US',
    graphApiVersion: 'v21.0',
    templateHasButton: true,
  },
  zoho: {
    dc: 'in',
    crm: {
      clientId: 'test-crm-client',
      clientSecret: 'test-crm-secret',
      refreshToken: 'test-crm-refresh',
    },
    commerce: {
      accountNumber: '12345',
      clientId: 'test-comm-client',
      clientSecret: 'test-comm-secret',
      refreshToken: 'test-comm-refresh',
    },
  },
};

// In-memory test database
const db = {
  users: [],
  dealers: [],
  otpCodes: [],
  refreshTokens: [],
  auditLog: [],
};

let nextId = 1000;

function resetDb() {
  db.users = [];
  db.dealers = [];
  db.otpCodes = [];
  db.refreshTokens = [];
  db.auditLog = [];
  nextId = 1000;
}

// In-memory mock SQL tag handler
function mockSql(strings, ...values) {
  const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), '');
  const qLower = query.toLowerCase();

  // DELETE FROM otp_codes
  if (qLower.includes('delete from otp_codes')) {
    if (query.includes('id =')) {
      const id = values[0];
      db.otpCodes = db.otpCodes.filter((o) => o.id !== id);
    } else if (query.includes('user_id =') && query.includes('identifier =') && query.includes('code_hash =')) {
      const [uId, ident, hash] = values;
      db.otpCodes = db.otpCodes.filter((o) => !(o.user_id === uId && o.identifier === ident && o.code_hash === hash));
    } else if (query.includes('user_id =') && query.includes('identifier =')) {
      const [uId, ident] = values;
      db.otpCodes = db.otpCodes.filter((o) => !(o.user_id === uId && o.identifier === ident));
    } else if (query.includes('user_id =')) {
      const [uId, ident1, ident2] = values;
      db.otpCodes = db.otpCodes.filter((o) => !(o.user_id === uId || o.identifier === ident1 || o.identifier === ident2));
    } else if (query.includes('identifier =')) {
      const [id1, id2] = values;
      db.otpCodes = db.otpCodes.filter((o) => o.identifier !== id1 && o.identifier !== id2);
    }
    return Promise.resolve([]);
  }

  // INSERT INTO otp_codes
  if (qLower.includes('insert into otp_codes')) {
    let newEntry;
    if (values.length === 3) {
      newEntry = {
        id: nextId++,
        identifier: values[0],
        code_hash: values[1],
        expires_at: values[2],
        attempts: 0,
        user_id: null,
        created_at: new Date(),
      };
    } else if (values.length === 4) {
      newEntry = {
        id: nextId++,
        user_id: values[0],
        identifier: values[1],
        code_hash: values[2],
        expires_at: values[3],
        attempts: 0,
        created_at: new Date(),
      };
    }
    if (newEntry) db.otpCodes.push(newEntry);
    return Promise.resolve(newEntry ? [newEntry] : []);
  }

  // SELECT ... FROM otp_codes
  if (qLower.includes('from otp_codes')) {
    const now = new Date();
    let matches = [...db.otpCodes];

    if (query.includes('user_id =') && query.includes('identifier =')) {
      const [uId, ident1, ident2] = values;
      matches = matches.filter((o) => o.user_id === uId && (o.identifier === ident1 || (ident2 && o.identifier === ident2)));
    } else if (query.includes('identifier =') || query.includes('user_id =')) {
      const val1 = values[0];
      const val2 = values[1];
      matches = matches.filter((o) => o.identifier === val1 || o.identifier === val2 || o.user_id === val1 || o.user_id === val2);
    }

    if (query.includes('expires_at > now()')) {
      matches = matches.filter((o) => new Date(o.expires_at) > now);
    }
    if (query.includes('attempts <')) {
      matches = matches.filter((o) => o.attempts < 5);
    }

    matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // UPDATE otp_codes SET attempts =
  if (qLower.includes('update otp_codes set attempts =')) {
    const attempts = values[0];
    const id = values[1];
    const row = db.otpCodes.find((o) => o.id === id);
    if (row) row.attempts = attempts;
    return Promise.resolve(row ? [row] : []);
  }

  // SELECT ... FROM users
  if (qLower.includes('from users')) {
    let matches = [...db.users];

    // Check id != and (phone = ... or phone like ...)
    if (query.includes('id !=') && (query.includes('phone =') || query.includes('phone like'))) {
      const phoneVal = values[0];
      const excludeId = values[values.length - 1];
      matches = matches.filter(
        (u) => u.id !== excludeId && (u.phone === phoneVal || (u.phone && phoneVal && u.phone.endsWith(phoneVal)))
      );
    } else if (query.includes('id !=') && query.includes('lower(email) =')) {
      const email = values[0];
      const excludeId = values[1];
      matches = matches.filter(
        (u) => u.id !== excludeId && u.email && u.email.toLowerCase() === email.toLowerCase()
      );
    } else {
      if (query.includes('phone =') || query.includes('phone like')) {
        const phoneVal = values[0];
        matches = matches.filter((u) => u.phone === phoneVal || (u.phone && phoneVal && u.phone.endsWith(phoneVal)));
      }
      if (query.includes('lower(email) =')) {
        const email = values[0];
        matches = matches.filter((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
      }
      if (query.includes('u.id =') || query.includes('where id =') || query.includes('where u.id =')) {
        const id = values[0];
        matches = matches.filter((u) => u.id === id);
      }
    }

    // Role priority sorting
    matches.sort((a, b) => {
      const roleScore = (r) => (r === 'dealer' ? 1 : r === 'dealer_staff' ? 2 : 3);
      return roleScore(a.role) - roleScore(b.role);
    });

    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // INSERT INTO users
  if (qLower.includes('insert into users')) {
    let newUser;
    if (query.includes('phone, role, status')) {
      newUser = {
        id: `user-${nextId++}`,
        phone: values[0],
        role: 'customer',
        status: 'active',
        email: null,
        full_name: null,
        email_verified: false,
        phone_verified: true,
        can_see_dealer_price: true,
        dealer_id: null,
        created_at: new Date(),
      };
    } else if (query.includes('email, password_hash')) {
      newUser = {
        id: `user-${nextId++}`,
        email: values[0],
        password_hash: values[1],
        full_name: values[2],
        role: 'customer',
        status: 'active',
        email_verified: false,
        phone_verified: false,
        phone: null,
        can_see_dealer_price: true,
        dealer_id: null,
        created_at: new Date(),
      };
    } else if (query.includes('email, full_name') || query.includes('(email,')) {
      newUser = {
        id: `user-${nextId++}`,
        email: values[0],
        password_hash: null,
        full_name: values[1],
        role: 'customer',
        status: 'active',
        email_verified: true,
        phone_verified: false,
        phone: null,
        can_see_dealer_price: true,
        dealer_id: null,
        created_at: new Date(),
      };
    }
    if (newUser) db.users.push(newUser);
    return Promise.resolve(newUser ? [newUser] : []);
  }

  // UPDATE users
  if (qLower.includes('update users')) {
    if (query.includes('phone =') && query.includes('phone_verified = true')) {
      const phone = values[0];
      const id = values[1];
      const user = db.users.find((u) => u.id === id);
      if (user) {
        user.phone = phone;
        user.phone_verified = true;
      }
      return Promise.resolve(user ? [user] : []);
    }
    if (query.includes('email =') && query.includes('email_verified = true')) {
      const email = values[0];
      const id = values[1];
      const user = db.users.find((u) => u.id === id);
      if (user) {
        user.email = email;
        user.email_verified = true;
      }
      return Promise.resolve(user ? [user] : []);
    }
    if (query.includes('email_verified = true')) {
      const id = values[0];
      const user = db.users.find((u) => u.id === id);
      if (user) user.email_verified = true;
      return Promise.resolve(user ? [user] : []);
    }
    if (query.includes('role =') && query.includes('dealer_id =')) {
      const [role, status, dealerId, id] = values;
      const user = db.users.find((u) => u.id === id);
      if (user) {
        user.role = role;
        user.status = status;
        user.dealer_id = dealerId;
      }
      return Promise.resolve(user ? [user] : []);
    }
    return Promise.resolve([]);
  }

  // SELECT ... FROM dealers
  if (qLower.includes('from dealers')) {
    let matches = [...db.dealers];
    if (query.includes('owner_user_id =')) {
      const ownerId = values.find((v) => typeof v === 'string' && v.startsWith('user-'));
      if (ownerId) matches = matches.filter((d) => d.owner_user_id === ownerId);
    }
    if (query.includes('id =')) {
      const id = values[0];
      matches = matches.filter((d) => d.id === id);
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
      status: values[5] || 'pending',
      dealer_code: values[6] || 'DE-TST-1234',
    };
    db.dealers.push(newDealer);
    return Promise.resolve([newDealer]);
  }

  // INSERT INTO refresh_tokens
  if (qLower.includes('insert into refresh_tokens')) {
    const entry = {
      id: nextId++,
      user_id: values[0],
      token_hash: values[1],
      expires_at: values[2],
      revoked: false,
    };
    db.refreshTokens.push(entry);
    return Promise.resolve([entry]);
  }

  // SELECT ... FROM refresh_tokens
  if (qLower.includes('from refresh_tokens')) {
    const hash = values[0];
    const rt = db.refreshTokens.find((r) => r.token_hash === hash);
    if (!rt) return Promise.resolve([]);
    const user = db.users.find((u) => u.id === rt.user_id);
    if (!user) return Promise.resolve([]);
    return Promise.resolve([
      {
        id: rt.id,
        user_id: rt.user_id,
        expires_at: rt.expires_at,
        revoked: rt.revoked,
        uid: user.id,
        email: user.email,
        phone: user.phone,
        phone_verified: user.phone_verified,
        role: user.role,
        status: user.status,
        dealer_id: user.dealer_id,
        email_verified: user.email_verified,
        can_see_dealer_price: user.can_see_dealer_price,
        full_name: user.full_name,
        created_at: user.created_at,
      },
    ]);
  }

  // INSERT INTO audit_events / audit_log
  if (qLower.includes('insert into audit_') || qLower.includes('insert into audit_log')) {
    const entry = {
      user_id: values[0],
      action: values[1],
      target_type: values[2],
      target_id: values[3],
    };
    db.auditLog.push(entry);
    return Promise.resolve([entry]);
  }

  return Promise.resolve([]);
}

mockSql.begin = async function (fn) {
  return fn(mockSql);
};

// Track notifications sent
const sentWhatsApp = [];
const sentEmails = [];

// Track CRM calls
const crmCalls = {
  updateContactDetails: [],
  failCrm: false,
};

// Mock modules
mock.module('../src/config/env.js', { namedExports: { env: testEnv } });
mock.module('../src/db/pool.js', { namedExports: { sql: mockSql, tx: (fn) => fn(mockSql) } });
mock.module('../src/services/notifications.js', {
  namedExports: {
    sendWhatsAppOtp: async ({ phone, code }) => {
      sentWhatsApp.push({ phone, code });
      return { ok: true, messageId: 'msg-wa-123' };
    },
    sendEmailOtp: async ({ email, code }) => {
      sentEmails.push({ email, code });
      return { ok: true, messageId: 'msg-em-123' };
    },
    notify: async () => ({ ok: true }),
  },
});
mock.module('../src/services/crmClient.js', {
  namedExports: {
    isCrmConfigured: () => true,
    updateContactDetails: async (contactId, details) => {
      crmCalls.updateContactDetails.push({ contactId, details });
      if (crmCalls.failCrm) throw new Error('CRM network timeout');
      return true;
    },
    createDealerAccount: async () => 'acc-zoho-123',
    createDealerContact: async () => 'con-zoho-123',
    linkContactToBackendUser: async () => {},
    getDealerAccount: async () => null,
    syncAccountUserSourceToContacts: async () => true,
    getPrimaryContactForAccount: async () => null,
  },
});
mock.module('../src/services/commerceClient.js', {
  namedExports: {
    isCommerceConfigured: () => true,
    resolvePricebookId: async () => 'pb-test-123',
    ensureContactPricebookForCrmAccount: async () => {},
    fetchCatalog: async () => [
      { product_id: 'p1', name: 'Premium Blender 750W', sku: 'PB750', mrp: 3499, dealer_rate: 2499 },
      { product_id: 'p2', name: 'Induction Cooktop', sku: 'IC200', mrp: 2999, dealer_rate: 2199 },
    ],
    fetchPricebookRates: async () => ({ p1: 2499, p2: 2199 }),
  },
});

// Import express routers
const { authRouter, publicUser, isUserFullyOnboarded } = await import('../src/routes/auth.js');
const { dealersRouter } = await import('../src/routes/dealers.js');
const { pricesRouter } = await import('../src/routes/prices.js');
const { signAccessToken } = await import('../src/services/tokens.js');

// Create test application
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/dealers', dealersRouter);
app.use('/api/prices', pricesRouter);
app.use((err, req, res, next) => {
  res.status(err.statusCode || err.status || 500).json({ error: err.message });
});

let server;
let baseUrl;

async function startServer() {
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

function authHeader(user) {
  return {
    Authorization: `Bearer ${signAccessToken(user)}`,
    'Content-Type': 'application/json',
  };
}

beforeEach(async () => {
  resetDb();
  sentWhatsApp.length = 0;
  sentEmails.length = 0;
  crmCalls.updateContactDetails.length = 0;
  crmCalls.failCrm = false;
  await startServer();
});

afterEach(async () => {
  await stopServer();
});

// ---------------------------------------------------------------------------
// 1. Phone OTP Request Tests
// ---------------------------------------------------------------------------
test('POST /api/auth/phone/request-otp rejects unauthenticated calls with 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/phone/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'auth_required');
});

test('POST /api/auth/phone/request-otp rejects invalid phone formats with 400', async () => {
  const user = { id: 'user-1', email: 'test@example.com', email_verified: true, phone_verified: false, role: 'customer', status: 'active' };
  db.users.push(user);

  for (const badPhone of ['12345', 'abcdefghij', '5555555555', '0000000000']) {
    const res = await fetch(`${baseUrl}/api/auth/phone/request-otp`, {
      method: 'POST',
      headers: authHeader(user),
      body: JSON.stringify({ phone: badPhone }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /valid 10-digit Indian mobile number/);
  }
});

test('POST /api/auth/phone/request-otp rejects if phone belongs to another account with 409 (no merge)', async () => {
  const user1 = { id: 'user-1', email: 'user1@example.com', phone: '9876543210', phone_verified: true, email_verified: true, role: 'customer', status: 'active' };
  const user2 = { id: 'user-2', email: 'user2@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active' };
  db.users.push(user1, user2);

  const res = await fetch(`${baseUrl}/api/auth/phone/request-otp`, {
    method: 'POST',
    headers: authHeader(user2),
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error, 'This phone number is already registered to another account');
  assert.equal(sentWhatsApp.length, 0); // No OTP dispatched to conflicting number
});

test('POST /api/auth/phone/request-otp succeeds for valid phone and sends WhatsApp OTP', async () => {
  const user = { id: 'user-1', email: 'user1@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/auth/phone/request-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.phone, '9876543210');
  assert.equal(data.destination, 'phone');
  assert.equal(sentWhatsApp.length, 1);
  assert.equal(sentWhatsApp[0].phone, '9876543210');

  // Stored hash in DB matches sent code via HMAC/timing-safe verification
  const storedOtp = db.otpCodes.find((o) => o.user_id === user.id && o.identifier === '9876543210');
  assert.ok(storedOtp);
  assert.equal(verifyOtpHash(sentWhatsApp[0].code, storedOtp.code_hash, '9876543210'), true);
});

// ---------------------------------------------------------------------------
// 2. Phone OTP Verification Tests
// ---------------------------------------------------------------------------
test('POST /api/auth/phone/verify-otp rejects invalid code with 401 and tracks remaining attempts', async () => {
  const user = { id: 'user-1', email: 'user1@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);
  db.otpCodes.push({
    id: nextId++,
    user_id: user.id,
    identifier: '9876543210',
    code_hash: sha256('654321'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '000000' }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /4 attempts remaining/);

  // Phone is NOT verified
  assert.equal(user.phone_verified, false);
});

test('POST /api/auth/phone/verify-otp locks out after 5 failed attempts with 429', async () => {
  const user = { id: 'user-1', email: 'user1@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);
  db.otpCodes.push({
    id: nextId++,
    user_id: user.id,
    identifier: '9876543210',
    code_hash: sha256('654321'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 4,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '111111' }),
  });
  assert.equal(res.status, 429);
  const data = await res.json();
  assert.match(data.error, /Too many failed verification attempts/);
});

test('POST /api/auth/phone/verify-otp rejects expired code with 401', async () => {
  const user = { id: 'user-1', email: 'user1@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);
  db.otpCodes.push({
    id: nextId++,
    user_id: user.id,
    identifier: '9876543210',
    code_hash: sha256('654321'),
    expires_at: new Date(Date.now() - 1000), // Expired
    attempts: 0,
    created_at: new Date(Date.now() - 15 * 60_000),
  });

  const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '654321' }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /Invalid or expired verification code/);
});

test('POST /api/auth/phone/verify-otp succeeds, updates phone_verified = true, and prevents code reuse', async () => {
  const user = { id: 'user-1', email: 'user1@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);
  db.otpCodes.push({
    id: 888,
    user_id: user.id,
    identifier: '9876543210',
    code_hash: sha256('654321'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '654321' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.phone_verified, true);
  assert.equal(data.user.phone, '9876543210');
  assert.equal(data.user.phone_verified, true);
  assert.equal(data.user.is_fully_onboarded, true); // Email was verified + phone now verified!

  // Database state check
  assert.equal(user.phone, '9876543210');
  assert.equal(user.phone_verified, true);

  // OTP was atomically deleted
  const remainingOtp = db.otpCodes.find((o) => o.id === 888);
  assert.equal(remainingOtp, undefined);

  // Second attempt with same code fails (re-use prevention)
  const resReuse = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '654321' }),
  });
  assert.equal(resReuse.status, 401);
});

// ---------------------------------------------------------------------------
// 3. Email Verification & Conflict Protection Tests
// ---------------------------------------------------------------------------
test('POST /api/auth/email/verify-otp rejects conflicting email with 409', async () => {
  const user1 = { id: 'user-1', email: 'alice@example.com', phone: '9876543210', phone_verified: true, email_verified: true, role: 'customer', status: 'active' };
  const user2 = { id: 'user-2', email: null, phone: '9876543211', phone_verified: true, email_verified: false, role: 'customer', status: 'active' };
  db.users.push(user1, user2);

  db.otpCodes.push({
    id: nextId++,
    user_id: user2.id,
    identifier: 'alice@example.com',
    code_hash: sha256('123456'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/email/verify-otp`, {
    method: 'POST',
    headers: authHeader(user2),
    body: JSON.stringify({ email: 'alice@example.com', code: '123456' }),
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.error, /already registered to another account/);
});

test('POST /api/auth/email/verify-otp marks email_verified = true and derives is_fully_onboarded', async () => {
  const user = { id: 'user-1', email: null, phone: '9876543210', phone_verified: true, email_verified: false, role: 'customer', status: 'active' };
  db.users.push(user);
  db.otpCodes.push({
    id: nextId++,
    user_id: user.id,
    identifier: 'bob@example.com',
    code_hash: sha256('123456'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/email/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ email: 'bob@example.com', code: '123456' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.email_verified, true);
  assert.equal(data.user.email, 'bob@example.com');
  assert.equal(data.user.email_verified, true);
  assert.equal(data.user.is_fully_onboarded, true);
});

// ---------------------------------------------------------------------------
// 4. Onboarding Status Matrix Tests
// ---------------------------------------------------------------------------
test('Onboarding status matrix correctly derives is_fully_onboarded across auth methods', async () => {
  // Case A: WhatsApp-first user with phone verified, no email
  const u1 = { id: 'u1', email: null, email_verified: false, phone: '9876543210', phone_verified: true };
  assert.equal(isUserFullyOnboarded(u1), false);
  assert.equal(publicUser(u1).is_fully_onboarded, false);

  // Case B: Google/Email user with email verified, no phone
  const u2 = { id: 'u2', email: 'test@example.com', email_verified: true, phone: null, phone_verified: false };
  assert.equal(isUserFullyOnboarded(u2), false);
  assert.equal(publicUser(u2).is_fully_onboarded, false);

  // Case C: User with both email and phone, but phone NOT verified
  const u3 = { id: 'u3', email: 'test@example.com', email_verified: true, phone: '9876543210', phone_verified: false };
  assert.equal(isUserFullyOnboarded(u3), false);
  assert.equal(publicUser(u3).is_fully_onboarded, false);

  // Case D: User with both email and phone, but email NOT verified
  const u4 = { id: 'u4', email: 'test@example.com', email_verified: false, phone: '9876543210', phone_verified: true };
  assert.equal(isUserFullyOnboarded(u4), false);
  assert.equal(publicUser(u4).is_fully_onboarded, false);

  // Case E: Fully onboarded user (both verified)
  const u5 = { id: 'u5', email: 'test@example.com', email_verified: true, phone: '9876543210', phone_verified: true };
  assert.equal(isUserFullyOnboarded(u5), true);
  assert.equal(publicUser(u5).is_fully_onboarded, true);
});

test('GET /api/auth/me returns accurate onboarding status and verification flags', async () => {
  const user = { id: 'user-1', email: 'me@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'GET',
    headers: authHeader(user),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email_verified, true);
  assert.equal(data.user.phone_verified, true);
  assert.equal(data.user.is_fully_onboarded, true);
});

// ---------------------------------------------------------------------------
// 5. Server-side Gate on Dealer Application Tests
// ---------------------------------------------------------------------------
test('POST /api/dealers/apply blocks user without verified email with 403', async () => {
  const user = { id: 'user-1', email: 'test@example.com', email_verified: false, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ business_name: 'Test Appliances' }),
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /Email verification is required before applying for dealer access/);
});

test('POST /api/dealers/apply blocks user without verified phone with 403', async () => {
  const user = { id: 'user-1', email: 'test@example.com', email_verified: true, phone: null, phone_verified: false, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ business_name: 'Test Appliances' }),
  });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /Phone verification via WhatsApp OTP is required before applying for dealer access/);
});

test('POST /api/dealers/apply allows fully verified user to apply', async () => {
  const user = { id: 'user-1', email: 'test@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/dealers/apply`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ business_name: 'Sunshine Electricals' }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, 'pending');
  assert.ok(data.dealer_id);
});

// ---------------------------------------------------------------------------
// 6. Retail Browsing vs Dealer Pricing Integrity Tests
// ---------------------------------------------------------------------------
test('Fully onboarded customer browsing /api/prices receives retail pricing only (no dealer leaks)', async () => {
  const user = { id: 'user-1', email: 'retail@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'customer', status: 'active' };
  db.users.push(user);

  const res = await fetch(`${baseUrl}/api/prices`, {
    method: 'GET',
    headers: authHeader(user),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.role, 'customer');
  assert.equal(data.price_tier, 'retail');

  // Verify that NO product reveals dealer_rate to the customer
  for (const prod of data.products) {
    assert.equal(prod.dealer_rate, undefined, 'Customer must never receive dealer_rate');
    assert.ok(prod.mrp > 0, 'Customer receives retail MRP');
  }
});

test('Approved dealer receives dealer pricing on /api/prices', async () => {
  const dealerId = 'dealer-fa0e';
  const dealerUser = { id: 'user-dlr', email: 'dealer@example.com', email_verified: true, phone: '9876543210', phone_verified: true, role: 'dealer', status: 'active', dealer_id: dealerId };
  db.users.push(dealerUser);
  db.dealers.push({ id: dealerId, owner_user_id: dealerUser.id, business_name: 'Approved Dealer Shop', status: 'approved', dealer_code: 'DE-APP-1234', price_tier: 'MH Dist Oct 2026' });

  const res = await fetch(`${baseUrl}/api/prices`, {
    method: 'GET',
    headers: authHeader(dealerUser),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.role, 'dealer');
  assert.equal(data.price_tier, 'dealer');

  for (const prod of data.products) {
    assert.ok(prod.dealer_rate > 0, 'Approved dealer receives dealer wholesale rate');
  }
});

// ---------------------------------------------------------------------------
// 7. Zoho CRM Sync and Failure Handling Tests
// ---------------------------------------------------------------------------
test('Verifying phone updates linked CRM Contact details', async () => {
  const user = { id: 'user-1', email: 'test@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active', zoho_contact_id: 'con-123' };
  db.users.push(user);
  db.otpCodes.push({
    id: nextId++,
    user_id: user.id,
    identifier: '9876543210',
    code_hash: sha256('654321'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '654321' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.phone_verified, true);
  assert.equal(data.crm_synced, true);

  // CRM client was called with contactId and phone
  assert.equal(crmCalls.updateContactDetails.length, 1);
  assert.equal(crmCalls.updateContactDetails[0].contactId, 'con-123');
  assert.equal(crmCalls.updateContactDetails[0].details.phone, '9876543210');
});

test('CRM update failure does not crash contact verification and reports crm_synced: false', async () => {
  crmCalls.failCrm = true; // Simulate CRM outage

  const user = { id: 'user-1', email: 'test@example.com', phone: null, phone_verified: false, email_verified: true, role: 'customer', status: 'active', zoho_contact_id: 'con-123' };
  db.users.push(user);
  db.otpCodes.push({
    id: nextId++,
    user_id: user.id,
    identifier: '9876543210',
    code_hash: sha256('654321'),
    expires_at: new Date(Date.now() + 10 * 60_000),
    attempts: 0,
    created_at: new Date(),
  });

  const res = await fetch(`${baseUrl}/api/auth/phone/verify-otp`, {
    method: 'POST',
    headers: authHeader(user),
    body: JSON.stringify({ phone: '9876543210', code: '654321' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  // Verification still succeeds!
  assert.equal(data.phone_verified, true);
  assert.equal(user.phone_verified, true);
  // Accurately reports CRM failure without falsely claiming success
  assert.equal(data.crm_synced, false);
});
