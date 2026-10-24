import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateLoginCode,
  formatLoginCode,
  isValidLoginCode,
  parseLoginCode,
  USER_CATEGORIES,
  GST_TREATMENT_OPTIONS,
} from '../src/utils/loginCode.js';

test('USER_CATEGORIES maps all 4 categories from specifications', () => {
  assert.equal(USER_CATEGORIES.dealer.prefix, 'DE');
  assert.equal(USER_CATEGORIES.staff.prefix, 'ST');
  assert.equal(USER_CATEGORIES.brand.prefix, 'BR');
  assert.equal(USER_CATEGORIES.customer.prefix, 'RC');
});

test('generateLoginCode generates standard DE-ABC-1234 format for Dealer', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateLoginCode('DE');
    assert.match(code, /^DE-[A-Z]{3}-\d{4}$/);
    assert.equal(isValidLoginCode(code), true);
  }
});

test('generateLoginCode generates standard ST-ABC-1234 format for Store Staff', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateLoginCode('ST');
    assert.match(code, /^ST-[A-Z]{3}-\d{4}$/);
    assert.equal(isValidLoginCode(code), true);
  }
});

test('generateLoginCode generates standard BR-ABC-1234 format for Brand Representative', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateLoginCode('BR');
    assert.match(code, /^BR-[A-Z]{3}-\d{4}$/);
    assert.equal(isValidLoginCode(code), true);
  }
});

test('generateLoginCode generates standard RC-ABC-1234 format for Retail Customer', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateLoginCode('RC');
    assert.match(code, /^RC-[A-Z]{3}-\d{4}$/);
    assert.equal(isValidLoginCode(code), true);
  }
});

test('formatLoginCode normalizes case and formats continuous input', () => {
  assert.equal(formatLoginCode('de-iak-2850'), 'DE-IAK-2850');
  assert.equal(formatLoginCode('deiak2850'), 'DE-IAK-2850');
  assert.equal(formatLoginCode('DE IAK 2850'), 'DE-IAK-2850');
  assert.equal(formatLoginCode('st-krt-1742'), 'ST-KRT-1742');
  assert.equal(formatLoginCode('stkrt1742'), 'ST-KRT-1742');
  assert.equal(formatLoginCode('br-mxz-6301'), 'BR-MXZ-6301');
  assert.equal(formatLoginCode('brmxz6301'), 'BR-MXZ-6301');
  assert.equal(formatLoginCode('rc-pta-9026'), 'RC-PTA-9026');
  assert.equal(formatLoginCode('rcpta9026'), 'RC-PTA-9026');
});

test('isValidLoginCode validates screenshot examples', () => {
  assert.equal(isValidLoginCode('DE-IAK-2850'), true);
  assert.equal(isValidLoginCode('ST-KRT-1742'), true);
  assert.equal(isValidLoginCode('BR-MXZ-6301'), true);
  assert.equal(isValidLoginCode('RC-PTA-9026'), true);
  assert.equal(isValidLoginCode('DE-ABC-1234'), true);

  // continuous also valid because formatLoginCode normalizes it
  assert.equal(isValidLoginCode('deiak2850'), true);

  // invalid formats
  assert.equal(isValidLoginCode(''), false);
  assert.equal(isValidLoginCode('DLR-123'), false);
  assert.equal(isValidLoginCode('DE-1234'), false);
  assert.equal(isValidLoginCode('DE-ABCD-1234'), false);
  assert.equal(isValidLoginCode('DE-ABC-123'), false);
});

test('parseLoginCode correctly splits components', () => {
  const parsed = parseLoginCode('de-iak-2850');
  assert.deepEqual(parsed, {
    prefix: 'DE',
    letters: 'IAK',
    digits: '2850',
    formatted: 'DE-IAK-2850',
  });
  assert.equal(parseLoginCode('invalid'), null);
});

test('GST_TREATMENT_OPTIONS includes all standard Zoho CRM options', () => {
  const values = GST_TREATMENT_OPTIONS.map((o) => o.value);
  assert.ok(values.includes('Registered Business - Regular'));
  assert.ok(values.includes('Registered Business - Composition'));
  assert.ok(values.includes('Unregistered Business'));
  assert.ok(values.includes('Consumer'));
  assert.ok(values.includes('Overseas'));
  assert.ok(values.includes('Special Economic Zone'));
  assert.ok(values.includes('Deemed Export'));
});
