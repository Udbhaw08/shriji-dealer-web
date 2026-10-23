import { test, mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-multi-auth-suite';
process.env.ENABLE_JOBS = 'false';

const testEnv = {
  jwtSecret: 'test-secret-for-multi-auth-suite',
  googleClientId: 'test-google-client-id-12345.apps.googleusercontent.com',
  whatsapp: {
    token: 'test-meta-token',
    phoneId: 'test-phone-id-12345',
    templateName: 'otp',
    templateLang: 'en_US',
    graphApiVersion: 'v21.0',
    templateHasButton: true,
  },
  resendApiKey: 're_test_key_12345',
};

// In-memory mock database state
const db = {
  users: [],
  dealers: [],
  refreshTokens: [],
  auditEvents: [],
  otpCodes: [],
};

function resetDb() {
  db.users = [];
  db.dealers = [];
  db.refreshTokens = [];
  db.auditEvents = [];
  db.otpCodes = [];
}

let nextId = 1;

// Mock SQL tagged template processor
function mockSql(strings, ...values) {
  const query = strings.join('?').trim();

  // BEGIN transaction
  if (query.startsWith('begin')) {
    return Promise.resolve();
  }

  // DELETE FROM otp_codes
  if (query.toLowerCase().includes('delete from otp_codes')) {
    if (query.includes('id =')) {
      const id = values[0];
      db.otpCodes = db.otpCodes.filter((o) => o.id !== id);
    } else if (query.includes('identifier =')) {
      const [id1, id2] = values;
      db.otpCodes = db.otpCodes.filter((o) => o.identifier !== id1 && o.identifier !== id2);
    }
    return Promise.resolve([]);
  }

  // INSERT INTO otp_codes
  if (query.toLowerCase().includes('insert into otp_codes')) {
    const newEntry = {
      id: nextId++,
      identifier: values[0],
      code_hash: values[1],
      expires_at: values[2],
      attempts: 0,
      created_at: new Date(),
    };
    db.otpCodes.push(newEntry);
    return Promise.resolve([newEntry]);
  }

  // SELECT ... FROM otp_codes
  if (query.toLowerCase().includes('from otp_codes')) {
    let matches = [...db.otpCodes];
    if (query.includes('expires_at > now()')) {
      matches = matches.filter((o) => new Date(o.expires_at) > new Date());
    }
    matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (query.includes('limit 1')) return Promise.resolve(matches.slice(0, 1));
    return Promise.resolve(matches);
  }

  // SELECT ... FROM users
  if (query.toLowerCase().includes('from users')) {
    let matches = [...db.users];
    if (query.includes('lower(u.email) =') || query.includes('lower(email) =')) {
      const email = String(values[0] || '').toLowerCase();
      matches = matches.filter((u) => u.email && u.email.toLowerCase() === email);
    } else if (query.includes('phone =') || query.includes('phone like')) {
      const phoneVal = values[0];
      matches = matches.filter((u) => u.phone === phoneVal || (u.phone && phoneVal && u.phone.endsWith(phoneVal)));
    } else if (query.includes('where id =') || query.includes('where u.id =')) {
      const id = values[0];
      matches = matches.filter((u) => u.id === id);
    }
    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // INSERT INTO users
  if (query.toLowerCase().includes('insert into users')) {
    let user;
    if (query.includes('phone, role, status') || query.includes('(phone,')) {
      user = {
        id: `user-${nextId++}`,
        phone: values[0],
        email: null,
        password_hash: null,
        full_name: null,
        role: 'customer',
        status: 'active',
        email_verified: false,
        dealer_id: null,
        created_at: new Date(),
      };
    } else if (query.includes('password_hash')) {
      user = {
        id: `user-${nextId++}`,
        email: values[0],
        password_hash: values[1],
        full_name: values[2],
        role: 'customer',
        status: 'active',
        email_verified: false,
        dealer_id: null,
        created_at: new Date(),
      };
    } else if (query.includes('email, full_name') || query.includes('(email,')) {
      // Google signup
      user = {
        id: `user-${nextId++}`,
        email: values[0],
        password_hash: null,
        full_name: values[1],
        role: 'customer',
        status: 'active',
        email_verified: true,
        dealer_id: null,
        created_at: new Date(),
      };
    }
    db.users.push(user);
    return Promise.resolve([user]);
  }

  // UPDATE users
  if (query.toLowerCase().includes('update users')) {
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
    if (query.includes('phone =')) {
      const [phone, id] = values;
      const user = db.users.find((u) => u.id === id);
      if (user) user.phone = phone;
      return Promise.resolve(user ? [user] : []);
    }
    return Promise.resolve([]);
  }

  // SELECT ... FROM dealers
  if (query.toLowerCase().includes('from dealers')) {
    let matches = [...db.dealers];
    const dealerId = values[0];
    const ownerUserId = values[1];
    matches = matches.filter(
      (d) => (dealerId && d.id === dealerId) || (ownerUserId && d.owner_user_id === ownerUserId),
    );
    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // INSERT INTO refresh_tokens
  if (query.toLowerCase().includes('insert into refresh_tokens')) {
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
  if (query.toLowerCase().includes('from refresh_tokens')) {
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
        role: user.role,
        status: user.status,
        dealer_id: user.dealer_id,
      },
    ]);
  }

  // UPDATE refresh_tokens
  if (query.toLowerCase().includes('update refresh_tokens set revoked = true')) {
    const id = values[0];
    const rt = db.refreshTokens.find((r) => r.id === id);
    if (rt) rt.revoked = true;
    return Promise.resolve(rt ? [rt] : []);
  }

  // INSERT INTO audit_log
  if (query.toLowerCase().includes('insert into audit_log') || query.toLowerCase().includes('audit')) {
    const entry = {
      actor_id: values[0],
      action: values[1],
      target_type: values[2],
      target_id: values[3],
    };
    db.auditEvents.push(entry);
    return Promise.resolve([entry]);
  }

  return Promise.resolve([]);
}

mockSql.begin = async (fn) => fn(mockSql);

// Mock Google OAuth2Client
class MockOAuth2Client {
  constructor(clientId) {
    this.clientId = clientId;
  }
  async verifyIdToken({ idToken, audience }) {
    if (idToken === 'valid-google-id-token') {
      return {
        getPayload: () => ({
          email: 'googleuser@example.com',
          name: 'Google User',
          given_name: 'Google',
          email_verified: true,
        }),
      };
    }
    if (idToken === 'dealer-google-token') {
      return {
        getPayload: () => ({
          email: 'dealer@shriji.com',
          name: 'Authorized Dealer',
          email_verified: true,
        }),
      };
    }
    throw new Error('Invalid Google token signature');
  }
}

// Module mocks
mock.module('../src/config/env.js', {
  namedExports: { env: testEnv },
});

mock.module('../src/db/pool.js', {
  namedExports: {
    sql: mockSql,
    tx: (fn) => fn(mockSql),
  },
});

mock.module('google-auth-library', {
  namedExports: {
    OAuth2Client: MockOAuth2Client,
  },
});

mock.module('../src/services/notifications.js', {
  namedExports: {
    sendWhatsAppOtp: async () => ({ ok: true }),
    sendEmailOtp: async () => ({ ok: true }),
    notify: async () => ({ ok: true }),
  },
});

// Import services and router under mock
const express = (await import('express')).default;
const { authRouter } = await import('../src/routes/auth.js');
const { hashPassword } = await import('../src/utils/hash.js');
const { sha256 } = await import('../src/utils/hash.js');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
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

await startServer();

after(async () => {
  await stopServer();
});

afterEach(() => {
  resetDb();
});

/* ========================================================================== */
/* Tests: Email/Password Signup & Duplicate Checks                           */
/* ========================================================================== */

test('POST /api/auth/signup successfully registers a new customer', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'newuser@example.com',
      password: 'password123',
      full_name: 'New User',
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.accessToken, 'Should return accessToken');
  assert.ok(data.refreshToken, 'Should return refreshToken');
  assert.equal(data.user.email, 'newuser@example.com');
  assert.equal(data.user.role, 'customer');
  assert.equal(data.user.status, 'active');
  assert.equal(data.user.email_verified, false);
});

test('POST /api/auth/signup rejects invalid emails', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'invalid-email',
      password: 'password123',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /valid email/i);
});

test('POST /api/auth/signup rejects passwords under 8 characters', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'user2@example.com',
      password: 'short',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /8 characters/i);
});

test('POST /api/auth/signup detects duplicate email and returns 409 Conflict', async () => {
  db.users.push({
    id: 'existing-1',
    email: 'existing@example.com',
    password_hash: await hashPassword('existingPassword1'),
    role: 'customer',
    status: 'active',
  });

  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'existing@example.com',
      password: 'password123',
    }),
  });

  assert.equal(res.status, 409);
  const data = await res.json();
  assert.match(data.error, /already exists/i);
});

/* ========================================================================== */
/* Tests: Email/Password Login                                                */
/* ========================================================================== */

test('POST /api/auth/login succeeds with correct email and password', async () => {
  db.users.push({
    id: 'user-login-1',
    email: 'registered@example.com',
    password_hash: await hashPassword('secretPassword123'),
    full_name: 'Registered User',
    role: 'customer',
    status: 'active',
  });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'registered@example.com',
      password: 'secretPassword123',
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.accessToken);
  assert.ok(data.refreshToken);
  assert.equal(data.user.email, 'registered@example.com');
});

test('POST /api/auth/login rejects incorrect password with 401', async () => {
  db.users.push({
    id: 'user-login-2',
    email: 'registered2@example.com',
    password_hash: await hashPassword('correctPassword'),
    role: 'customer',
    status: 'active',
  });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'registered2@example.com',
      password: 'wrongPassword',
    }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /invalid email or password/i);
});

test('POST /api/auth/login rejects unregistered email with 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent@example.com',
      password: 'somePassword',
    }),
  });

  assert.equal(res.status, 401);
});

/* ========================================================================== */
/* Tests: Google Sign-In & Verification                                       */
/* ========================================================================== */

test('POST /api/auth/google rejects missing credential with 400', async () => {
  const res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /credential token is required/i);
});

test('POST /api/auth/google rejects invalid credential token with 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'invalid-token' }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /invalid google token/i);
});

test('POST /api/auth/google creates new user with email_verified: true', async () => {
  const res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'valid-google-id-token' }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.accessToken);
  assert.equal(data.user.email, 'googleuser@example.com');
  assert.equal(data.user.role, 'customer');
  assert.equal(data.user.email_verified, true);
});

test('POST /api/auth/google marks email_verified for existing unverified account', async () => {
  db.users.push({
    id: 'user-google-exist',
    email: 'googleuser@example.com',
    password_hash: await hashPassword('password123'),
    full_name: 'Unverified Password User',
    role: 'customer',
    status: 'active',
    email_verified: false,
  });

  const res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'valid-google-id-token' }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email, 'googleuser@example.com');
  assert.equal(data.user.email_verified, true);

  const updated = db.users.find((u) => u.email === 'googleuser@example.com');
  assert.equal(updated.email_verified, true);
});

/* ========================================================================== */
/* Tests: Role Preservation & Dealer Security Protections                     */
/* ========================================================================== */

test('Approved dealer logging in with Google retains dealer role and permissions', async () => {
  const dealerId = 'dealer-corp-123';
  db.dealers.push({
    id: dealerId,
    business_name: 'Shriji Authorized Dealer',
    dealer_code: 'DE-SHR-001',
    status: 'approved',
    owner_user_id: 'user-dealer-1',
  });

  db.users.push({
    id: 'user-dealer-1',
    email: 'dealer@shriji.com',
    role: 'dealer',
    status: 'active',
    dealer_id: dealerId,
    email_verified: true,
  });

  const res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'dealer-google-token' }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.user.email, 'dealer@shriji.com');
  assert.equal(data.user.role, 'dealer', 'Must retain dealer role');
  assert.equal(data.user.dealer_id, dealerId, 'Must preserve dealer association');
});

test('Customer cannot elevate to dealer via signup or login', async () => {
  const res = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hacker@example.com',
      password: 'password123',
      role: 'dealer', // Attempt privilege escalation
    }),
  });

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.user.role, 'customer', 'Role must default strictly to customer');
  assert.equal(data.user.dealer_id, null);
});

/* ========================================================================== */
/* Tests: WhatsApp OTP Regression                                             */
/* ========================================================================== */

test('WhatsApp OTP request and verify workflow succeeds without regressions', async () => {
  // Request OTP
  const reqRes = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210' }),
  });
  assert.equal(reqRes.status, 200);

  // Locate generated OTP code from mock DB
  const otpEntry = db.otpCodes.find((o) => o.identifier === '9876543210');
  assert.ok(otpEntry, 'OTP code should be generated in database');

  // Verify with wrong code -> 401
  const failRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210', code: '000000' }),
  });
  assert.equal(failRes.status, 401);

  // Set predictable hash for verification test
  otpEntry.code_hash = sha256('654321');
  const verifyRes = await fetch(`${baseUrl}/api/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9876543210', code: '654321' }),
  });
  assert.equal(verifyRes.status, 200);
  const verifyData = await verifyRes.json();
  assert.ok(verifyData.accessToken);
  assert.equal(verifyData.user.phone, '9876543210');
});

/* ========================================================================== */
/* Tests: Token Rotation & Session Refresh                                    */
/* ========================================================================== */

test('POST /api/auth/refresh rotates valid refresh token', async () => {
  const userId = 'user-rot-1';
  db.users.push({
    id: userId,
    email: 'refresh@example.com',
    role: 'customer',
    status: 'active',
  });

  const rawToken = 'raw-refresh-token-xyz';
  db.refreshTokens.push({
    id: 101,
    user_id: userId,
    token_hash: sha256(rawToken),
    expires_at: new Date(Date.now() + 100000),
    revoked: false,
  });

  const res = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rawToken }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.accessToken);
  assert.ok(data.refreshToken);
  assert.notEqual(data.refreshToken, rawToken, 'Refresh token must rotate');
});
