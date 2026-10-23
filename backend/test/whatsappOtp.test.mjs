import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-whatsapp-otp-suite';
process.env.ENABLE_JOBS = 'false';

const testEnv = {
  jwtSecret: 'test-secret-for-whatsapp-otp-suite',
  whatsapp: {
    token: 'test-meta-token',
    phoneId: 'test-phone-id-12345',
    templateName: 'otp',
    templateLang: 'en_US',
    graphApiVersion: 'v21.0',
    templateHasButton: true,
  },
  resendApiKey: 're_test_key_12345',
  googleClientId: '',
};

// In-memory mock database state
const db = {
  otpCodes: [],
  users: [],
  dealers: [],
  refreshTokens: [],
  auditEvents: [],
};

function resetDb() {
  db.otpCodes = [];
  db.users = [];
  db.dealers = [];
  db.refreshTokens = [];
  db.auditEvents = [];
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
    } else if (query.includes('identifier =') && query.includes('code_hash =')) {
      const [ident, hash] = values;
      db.otpCodes = db.otpCodes.filter((o) => !(o.identifier === ident && o.code_hash === hash));
    } else if (query.includes('identifier =')) {
      const [id1, id2] = values;
      db.otpCodes = db.otpCodes.filter((o) => o.identifier !== id1 && o.identifier !== id2);
    }
    return Promise.resolve([]);
  }

  // INSERT INTO otp_codes
  if (query.toLowerCase().includes('insert into otp_codes')) {
    // values can be (identifier, code_hash, expires_at) or (user_id, identifier, code_hash, expires_at)
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
  if (query.toLowerCase().includes('from otp_codes')) {
    const now = new Date();
    let matches = [...db.otpCodes];

    if (query.includes('identifier =') || query.includes('user_id =')) {
      const val1 = values[0];
      const val2 = values[1];
      matches = matches.filter((o) => o.identifier === val1 || o.identifier === val2 || o.user_id === val1 || o.user_id === val2);
    }

    if (query.includes('expires_at > now()')) {
      matches = matches.filter((o) => new Date(o.expires_at) > now);
    }

    // Sort by created_at desc
    matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (query.includes('limit 1')) {
      return Promise.resolve(matches.slice(0, 1));
    }
    return Promise.resolve(matches);
  }

  // UPDATE otp_codes SET attempts =
  if (query.toLowerCase().includes('update otp_codes set attempts =')) {
    const attempts = values[0];
    const id = values[1];
    const row = db.otpCodes.find((o) => o.id === id);
    if (row) row.attempts = attempts;
    return Promise.resolve(row ? [row] : []);
  }

  // SELECT ... FROM users
  if (query.toLowerCase().includes('from users')) {
    let matches = [...db.users];
    if (query.includes('phone =') || query.includes('phone like')) {
      const phoneVal = values[0];
      matches = matches.filter((u) => u.phone === phoneVal || (u.phone && phoneVal && u.phone.endsWith(phoneVal)));
    }
    if (query.includes('lower(email) =')) {
      const email = values[0];
      matches = matches.filter((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
    }
    if (query.includes('id =')) {
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
        role: values[3],
        status: values[4],
        email_verified: values[5],
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
  if (query.toLowerCase().includes('update users')) {
    if (query.includes('phone =')) {
      const phone = values[0];
      const id = values[1];
      const user = db.users.find((u) => u.id === id);
      if (user) user.phone = phone;
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
    return Promise.resolve([]);
  }

  // SELECT ... FROM dealers
  if (query.toLowerCase().includes('from dealers')) {
    let matches = [...db.dealers];
    if (query.includes('owner_user_id =')) {
      const ownerId = values[values.length - 1];
      matches = matches.filter((d) => d.owner_user_id === ownerId);
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

  // INSERT INTO refresh_tokens
  if (query.toLowerCase().includes('insert into refresh_tokens')) {
    const entry = {
      user_id: values[0],
      token_hash: values[1],
      expires_at: values[2],
    };
    db.refreshTokens.push(entry);
    return Promise.resolve([entry]);
  }

  // INSERT INTO audit_events
  if (query.toLowerCase().includes('insert into audit_events')) {
    const entry = {
      user_id: values[0],
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

const logEntries = [];

// Intercept modules before importing authRouter & notifications
mock.module('../src/config/env.js', {
  namedExports: { env: testEnv },
});

mock.module('../src/db/pool.js', {
  namedExports: {
    sql: mockSql,
    tx: (fn) => fn(mockSql),
  },
});

mock.module('../src/utils/logger.js', {
  namedExports: {
    log: {
      info: (...args) => logEntries.push({ level: 'info', msg: args.join(' ') }),
      warn: (...args) => logEntries.push({ level: 'warn', msg: args.join(' ') }),
      error: (...args) => logEntries.push({ level: 'error', msg: args.join(' ') }),
    },
  },
});

const originalFetch = globalThis.fetch;

// Import services and router under mock
const { sendWhatsAppOtp } = await import('../src/services/notifications.js');
const express = (await import('express')).default;
const { authRouter } = await import('../src/routes/auth.js');
const { signAccessToken, verifyAccessToken } = await import('../src/services/tokens.js');

// Create test express application
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

// Error handler
app.use((err, req, res, next) => {
  res.status(err.statusCode || err.status || 500).json({ error: err.message, metaCode: err.metaCode });
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

function resetConfig() {
  testEnv.whatsapp.token = 'test-meta-token';
  testEnv.whatsapp.phoneId = 'test-phone-id-12345';
  testEnv.whatsapp.templateName = 'otp';
  testEnv.whatsapp.templateLang = 'en_US';
  testEnv.whatsapp.graphApiVersion = 'v21.0';
  testEnv.whatsapp.templateHasButton = true;
  logEntries.length = 0;
  resetDb();
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetConfig();
});

/* =========================================================================
 * 1. Meta WhatsApp Cloud API Service Unit Tests (sendWhatsAppOtp)
 * ========================================================================= */

test('sendWhatsAppOtp rejects invalid phone numbers with 400', async () => {
  resetConfig();
  await assert.rejects(
    sendWhatsAppOtp({ phone: '12345', code: '123456' }),
    (err) => err.statusCode === 400 && /valid 10-digit Indian mobile number/.test(err.message)
  );

  await assert.rejects(
    sendWhatsAppOtp({ phone: '5555555555', code: '123456' }), // starts with 5 (not 6-9)
    (err) => err.statusCode === 400
  );
});

test('sendWhatsAppOtp rejects when Meta credentials are missing with 503', async () => {
  resetConfig();
  testEnv.whatsapp.token = '';
  testEnv.whatsapp.phoneId = '';

  await assert.rejects(
    sendWhatsAppOtp({ phone: '9876543210', code: '123456' }),
    (err) => err.statusCode === 503 && /WhatsApp messaging service is not configured/.test(err.message)
  );
});

test('sendWhatsAppOtp sends valid template request with body and button parameters', async () => {
  resetConfig();
  const intercepted = [];

  globalThis.fetch = async (url, options) => {
    intercepted.push({
      url: String(url),
      method: options.method,
      headers: options.headers,
      body: JSON.parse(options.body),
    });
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.HBgLMTIzNDU2Nzg5MA==' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await sendWhatsAppOtp({ phone: '9876543210', code: '654321' });

  assert.equal(result.provider, 'whatsapp');
  assert.equal(result.accepted, true);
  assert.equal(result.messageId, 'wamid.HBgLMTIzNDU2Nzg5MA==');

  assert.equal(intercepted.length, 1);
  const req = intercepted[0];
  assert.equal(req.url, 'https://graph.facebook.com/v21.0/test-phone-id-12345/messages');
  assert.equal(req.headers.Authorization, 'Bearer test-meta-token');
  assert.equal(req.body.messaging_product, 'whatsapp');
  assert.equal(req.body.to, '919876543210');
  assert.equal(req.body.type, 'template');
  assert.equal(req.body.template.name, 'otp');
  assert.equal(req.body.template.language.code, 'en_US');

  // Verify body and button parameters
  const components = req.body.template.components;
  assert.equal(components.length, 2);
  assert.equal(components[0].type, 'body');
  assert.equal(components[0].parameters[0].text, '654321');
  assert.equal(components[1].type, 'button');
  assert.equal(components[1].sub_type, 'url');
  assert.equal(components[1].index, '0');
  assert.equal(components[1].parameters[0].text, '654321');

  // Verify secret OTP is not leaked in log messages
  assert.equal(logEntries.some((l) => l.msg.includes('654321')), false);
});

test('sendWhatsAppOtp handles Meta sandbox unpermitted number (code 131030) safely', async () => {
  resetConfig();

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Recipient phone number not in allowed list',
          type: 'OAuthException',
          code: 131030,
          fbtrace_id: 'An8vK_dummy',
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  await assert.rejects(
    sendWhatsAppOtp({ phone: '9876543210', code: '112233' }),
    (err) =>
      err.statusCode === 502 &&
      err.metaCode === 131030 &&
      /not permitted in sandbox testing/.test(err.message)
  );

  // Verifies code is not logged
  assert.equal(logEntries.some((l) => l.msg.includes('112233')), false);
});

test('sendWhatsAppOtp handles Meta expired/invalid token (code 190) safely', async () => {
  resetConfig();

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Error validating access token: Session has expired',
          code: 190,
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  };

  await assert.rejects(
    sendWhatsAppOtp({ phone: '9876543210', code: '998877' }),
    (err) => err.statusCode === 502 && /authorization is invalid or expired/.test(err.message)
  );
});

test('sendWhatsAppOtp handles template unavailable (code 132001) safely', async () => {
  resetConfig();

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Template does not exist or is undergoing review',
          code: 132001,
        },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  };

  await assert.rejects(
    sendWhatsAppOtp({ phone: '9876543210', code: '998877' }),
    (err) => err.statusCode === 502 && /template is unavailable/.test(err.message)
  );
});

test('sendWhatsAppOtp handles network timeout or fetch failure', async () => {
  resetConfig();

  globalThis.fetch = async () => {
    throw new TypeError('fetch failed: connect ETIMEDOUT');
  };

  await assert.rejects(
    sendWhatsAppOtp({ phone: '9876543210', code: '334455' }),
    (err) => err.statusCode === 502 && /Unable to reach WhatsApp messaging server/.test(err.message)
  );
});

/* =========================================================================
 * 2. HTTP Endpoint Tests: POST /api/auth/otp/request & /verify
 * ========================================================================= */

test('HTTP POST /api/auth/otp/request succeeds for valid phone and stores SHA-256 hash', async () => {
  resetConfig();
  await startServer();

  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('graph.facebook.com')) {
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.TEST_REQUEST_ID' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, options);
    };

    const res = await (await import('node:http')).get; // using fetch against local server
    const response = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' }),
    });

    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.destination, 'phone');
    assert.equal(data.expires_in_minutes, 10);
    assert.equal(data.dev_code, undefined); // never leaks OTP in response

    // Verify database state: exactly one OTP code stored, with SHA-256 hash (never plain text)
    assert.equal(db.otpCodes.length, 1);
    const stored = db.otpCodes[0];
    assert.equal(stored.identifier, '9876543210');
    assert.match(stored.code_hash, /^[a-f0-9]{64}$/); // 64 hex characters
    assert.notEqual(stored.code_hash, '123456');
    assert.ok(new Date(stored.expires_at) > new Date());
  } finally {
    await stopServer();
  }
});

test('HTTP POST /api/auth/otp/request purges pending code if Meta send fails', async () => {
  resetConfig();
  await startServer();

  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('graph.facebook.com')) {
        return new Response(
          JSON.stringify({ error: { message: 'Meta rejected message', code: 131030 } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, options);
    };

    const response = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' }),
    });

    assert.equal(response.status, 502);

    // Verify un-delivered code was purged from DB
    assert.equal(db.otpCodes.length, 0);
  } finally {
    await stopServer();
  }
});

test('HTTP POST /api/auth/otp/request enforces rate limiting on rapid requests', async () => {
  resetConfig();
  process.env.TEST_RATE_LIMIT = 'true';
  await startServer();

  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('graph.facebook.com')) {
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.OK' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, options);
    };

    // Rate limit is 6 requests per 10 minutes
    const statuses = [];
    for (let i = 0; i < 7; i++) {
      const res = await fetch(`${baseUrl}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543210' }),
      });
      statuses.push(res.status);
    }

    assert.equal(statuses.slice(0, 6).every((s) => s === 200), true);
    assert.equal(statuses[6], 429); // 7th request blocked
  } finally {
    delete process.env.TEST_RATE_LIMIT;
    await stopServer();
  }
});

test('HTTP POST /api/auth/otp/verify validates wrong code, enforces 5-attempt limit, and atomic single-use', async () => {
  resetConfig();
  await startServer();

  try {
    const { sha256 } = await import('../src/utils/hash.js');
    const realCode = '456789';

    // Seed active OTP
    db.otpCodes.push({
      id: 101,
      identifier: '9876543210',
      code_hash: sha256(realCode),
      expires_at: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      user_id: null,
      created_at: new Date(),
    });

    // 1. Send wrong code
    const resWrong = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', code: '000000' }),
    });

    const dataWrong = await resWrong.json();
    assert.equal(resWrong.status, 401);
    assert.match(dataWrong.error, /Invalid verification code\. 4 attempts remaining/);

    // Verify attempt counter incremented
    assert.equal(db.otpCodes[0].attempts, 1);

    // 2. Simulate 4 more failed attempts to reach attempt limit (total 5)
    db.otpCodes[0].attempts = 4;
    const resLimit = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', code: '000000' }),
    });

    assert.equal(resLimit.status, 429);
    assert.match((await resLimit.json()).error, /Too many failed verification attempts/);

    // Verify code is deleted on lockout
    assert.equal(db.otpCodes.length, 0);

    // 3. Re-seed new valid OTP
    db.otpCodes.push({
      id: 102,
      identifier: '9876543210',
      code_hash: sha256('123456'),
      expires_at: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      user_id: null,
      created_at: new Date(),
    });

    // 4. Successful verification
    const resSuccess = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', code: '123456' }),
    });

    const dataSuccess = await resSuccess.json();
    assert.equal(resSuccess.status, 200);
    assert.ok(dataSuccess.accessToken);
    assert.ok(dataSuccess.refreshToken);
    assert.equal(dataSuccess.user.phone, '9876543210');
    assert.equal(dataSuccess.user.role, 'customer'); // auto-provisioned as customer

    // Verify JWT payload
    const decoded = verifyAccessToken(dataSuccess.accessToken);
    assert.equal(decoded.role, 'customer');

    // 5. Verify atomic consumption: OTP code was deleted from DB
    assert.equal(db.otpCodes.length, 0);

    // 6. Reuse attempt fails (replay attack prevented)
    const resReuse = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', code: '123456' }),
    });

    assert.equal(resReuse.status, 401);
  } finally {
    await stopServer();
  }
});

test('HTTP POST /api/auth/otp/verify rejects expired OTP', async () => {
  resetConfig();
  await startServer();

  try {
    const { sha256 } = await import('../src/utils/hash.js');

    // Seed expired OTP (expired 1 minute ago)
    db.otpCodes.push({
      id: 103,
      identifier: '9876543210',
      code_hash: sha256('654321'),
      expires_at: new Date(Date.now() - 60_000),
      attempts: 0,
      user_id: null,
      created_at: new Date(Date.now() - 11 * 60_000),
    });

    const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', code: '654321' }),
    });

    assert.equal(res.status, 401);
    assert.match((await res.json()).error, /Invalid or expired verification code/);
  } finally {
    await stopServer();
  }
});

test('HTTP POST /api/auth/otp/verify recognizes existing dealer accounts', async () => {
  resetConfig();
  await startServer();

  try {
    const { sha256 } = await import('../src/utils/hash.js');

    // Seed dealer user and dealer record
    const dealerUser = {
      id: 'dealer-user-uuid-1',
      phone: '8826867932',
      role: 'dealer',
      status: 'active',
      email: 'owner@dealership.com',
      full_name: 'Shriji Authorized Dealer',
      email_verified: true,
      can_see_dealer_price: true,
      dealer_id: 'dealer-record-uuid-1',
      created_at: new Date(),
    };
    db.users.push(dealerUser);

    db.dealers.push({
      id: 'dealer-record-uuid-1',
      owner_user_id: dealerUser.id,
      dealer_code: 'DE-BKV-8180',
      business_name: 'Ownershop Appliances',
      status: 'approved',
      price_tier: 'MH Dist Basic Oct 2026',
    });

    // Seed active OTP
    db.otpCodes.push({
      id: 104,
      identifier: '8826867932',
      code_hash: sha256('882688'),
      expires_at: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      user_id: null,
      created_at: new Date(),
    });

    const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '8826867932', code: '882688' }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.user.role, 'dealer');
    assert.equal(data.user.phone, '8826867932');

    const decoded = verifyAccessToken(data.accessToken);
    assert.equal(decoded.role, 'dealer');
    assert.equal(decoded.dealer_id, 'dealer-record-uuid-1');
  } finally {
    await stopServer();
  }
});

/* =========================================================================
 * 3. Email Authentication & Verification Regression Tests
 * ========================================================================= */

test('HTTP POST /api/auth/email/request-otp rejects unauthenticated calls with 401', async () => {
  resetConfig();
  await startServer();

  try {
    const res = await fetch(`${baseUrl}/api/auth/email/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    assert.equal(res.status, 401);
  } finally {
    await stopServer();
  }
});

test('HTTP POST /api/auth/email/verify-otp marks user as email_verified for authenticated session', async () => {
  resetConfig();
  await startServer();

  try {
    const { sha256 } = await import('../src/utils/hash.js');

    const testUser = {
      id: 'email-verify-user-uuid',
      phone: '9876543210',
      role: 'customer',
      status: 'active',
      email: null,
      email_verified: false,
      can_see_dealer_price: true,
      created_at: new Date(),
    };
    db.users.push(testUser);

    const token = signAccessToken(testUser);

    // Seed email OTP
    db.otpCodes.push({
      id: 201,
      identifier: 'verified@example.com',
      user_id: testUser.id,
      code_hash: sha256('556677'),
      expires_at: new Date(Date.now() + 10 * 60_000),
      attempts: 0,
      created_at: new Date(),
    });

    const res = await fetch(`${baseUrl}/api/auth/email/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: 'verified@example.com', code: '556677' }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.email_verified, true);

    // Verify user record updated in database
    const userInDb = db.users.find((u) => u.id === testUser.id);
    assert.equal(userInDb.email, 'verified@example.com');
    assert.equal(userInDb.email_verified, true);

    // Verify OTP row consumed atomically
    assert.equal(db.otpCodes.length, 0);
  } finally {
    await stopServer();
  }
});

