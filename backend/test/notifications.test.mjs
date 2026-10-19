import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const logEntries = [];
const testEnv = {
  whatsapp: {
    token: '',
    phoneId: '',
    templateName: '',
    templateLang: 'en_US',
  },
  fast2smsApiKey: '',
  twilio: {
    accountSid: '',
    authToken: '',
    from: '',
  },
  resendApiKey: '',
};

mock.module('../src/db/pool.js', {
  namedExports: {
    sql: async () => [],
  },
});

mock.module('../src/config/env.js', {
  namedExports: {
    env: testEnv,
  },
});

mock.module('../src/utils/logger.js', {
  namedExports: {
    log: {
      info: (...args) => logEntries.push(args),
      warn: (...args) => logEntries.push(args),
      error: (...args) => logEntries.push(args),
    },
  },
});

const { sendOtpNotification } = await import('../src/services/notifications.js');
const originalFetch = globalThis.fetch;

function resetConfig() {
  testEnv.whatsapp.token = '';
  testEnv.whatsapp.phoneId = '';
  testEnv.whatsapp.templateName = '';
  testEnv.whatsapp.templateLang = 'en_US';
  testEnv.fast2smsApiKey = '';
  testEnv.twilio.accountSid = '';
  testEnv.twilio.authToken = '';
  testEnv.twilio.from = '';
  logEntries.length = 0;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetConfig();
});

test('phone OTP fails when no delivery provider is configured and never logs the code', async () => {
  resetConfig();

  await assert.rejects(
    sendOtpNotification({ phone: '+918743874632', code: '123456' }),
    /No configured SMS or WhatsApp provider accepted/
  );

  assert.equal(logEntries.some((entry) => entry.join(' ').includes('123456')), false);
});

test('WhatsApp OTP uses the configured template and reports provider acceptance', async () => {
  resetConfig();
  testEnv.whatsapp.token = 'test-token';
  testEnv.whatsapp.phoneId = 'test-phone-id';
  testEnv.whatsapp.templateName = 'verification_code';

  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.test-message' }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await sendOtpNotification({ phone: '+918743874632', code: '123456' });

  assert.deepEqual(result.providers, ['whatsapp']);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /graph\.facebook\.com/);
  assert.equal(requests[0].body.type, 'template');
  assert.equal(requests[0].body.template.name, 'verification_code');
  assert.equal(requests[0].body.template.components[0].parameters[0].text, '123456');
  assert.equal(requests[0].body.template.components[1].sub_type, 'url');
  assert.equal(requests[0].body.template.components[1].parameters[0].text, '123456');
  assert.equal(requests[0].body.text, undefined);
  assert.equal(logEntries.some((entry) => entry.join(' ').includes('123456')), false);
});

test('WhatsApp rejection falls back to configured SMS and reports SMS as provider', async () => {
  resetConfig();
  testEnv.whatsapp.token = 'test-token';
  testEnv.whatsapp.phoneId = 'test-phone-id';
  testEnv.whatsapp.templateName = 'verification_code';
  testEnv.fast2smsApiKey = 'test-fast2sms-key';

  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    if (String(url).includes('graph.facebook.com')) {
      return new Response(JSON.stringify({ error: { message: 'template rejected for test' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ return: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await sendOtpNotification({ phone: '+918743874632', code: '654321' });

  assert.deepEqual(result.providers, ['fast2sms']);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.type, 'template');
  assert.match(requests[1].url, /fast2sms\.com/);
  assert.equal(logEntries.some((entry) => entry.join(' ').includes('654321')), false);
});
