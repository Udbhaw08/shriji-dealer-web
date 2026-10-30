import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmail,
  normalizeEmail,
  isValidPhone,
  isValidName,
  cleanName,
  isValidGstin,
  isValidPincode,
  isGstRequiredTreatment,
} from '../src/utils/validators.js';

test('isValidEmail accepts only valid RFC 5322 emails with valid domains', () => {
  const validEmails = [
    'user@example.com',
    'sharma.dealer@shriji.co.in',
    'support+orders@domain.org',
    'customer123@sub.company.io',
    'first.last@my-domain.net',
  ];

  for (const email of validEmails) {
    assert.equal(isValidEmail(email), true, `Expected valid: ${email}`);
  }
});

test('isValidEmail rejects malformed, incomplete, or arbitrary non-email inputs', () => {
  const invalidEmails = [
    '',
    '   ',
    null,
    undefined,
    'plainaddress',
    '@missingusername.com',
    'username@.com',
    'username@com',
    'username@domain',
    'username@domain.',
    'user name@domain.com',
    'user@domain..com',
    '1234567890',
    'test@localhost',
  ];

  for (const email of invalidEmails) {
    assert.equal(isValidEmail(email), false, `Expected invalid: ${email}`);
  }
});

test('normalizeEmail lowercases, trims and returns null for invalid inputs', () => {
  assert.equal(normalizeEmail('  Dealer@COMPANY.COM  '), 'dealer@company.com');
  assert.equal(normalizeEmail('invalid-input'), null);
  assert.equal(normalizeEmail(''), null);
  assert.equal(normalizeEmail(null), null);
});

test('isValidPhone accepts only 10-digit Indian numbers starting with 6-9', () => {
  assert.equal(isValidPhone('9876543210'), true);
  assert.equal(isValidPhone('+919876543210'), true);
  assert.equal(isValidPhone('+91 87654 32109'), true);
  assert.equal(isValidPhone('7123456789'), true);
  assert.equal(isValidPhone('6123456789'), true);

  // Invalid numbers
  assert.equal(isValidPhone('1234567890'), false); // Starts with 1
  assert.equal(isValidPhone('0987654321'), false); // 0 prefix invalid as 10-digit
  assert.equal(isValidPhone('5555555555'), false); // Starts with 5
  assert.equal(isValidPhone('98765'), false); // Too short
  assert.equal(isValidPhone(''), false);
  assert.equal(isValidPhone(null), false);
});

test('isValidName ensures 2-60 alphabetic characters and cleanName cleans whitespace', () => {
  assert.equal(isValidName('Rajesh'), true);
  assert.equal(isValidName('Kumar'), true);
  assert.equal(isValidName("O'Connor"), true);
  assert.equal(isValidName('Anne-Marie'), true);

  assert.equal(isValidName('A'), false); // Too short
  assert.equal(isValidName('12345'), false); // Numbers
  assert.equal(isValidName('John_Doe'), false); // Special symbol
  assert.equal(isValidName(''), false);

  assert.equal(cleanName('   Rajesh   Kumar  '), 'Rajesh Kumar');
  assert.equal(cleanName(''), '');
  assert.equal(cleanName(null), '');
});

test('isValidGstin validates standard 15-character Indian GST format', () => {
  assert.equal(isValidGstin('27AAAAA0000A1Z5'), true);
  assert.equal(isValidGstin('27aaaaa0000a1z5'), true); // Case-insensitive
  assert.equal(isValidGstin('27AAAAA0000A1Z'), false); // 14 chars
  assert.equal(isValidGstin('INVALIDGST12345'), false);
  assert.equal(isValidGstin(''), false);
});

test('isValidPincode validates 6-digit Indian PIN codes', () => {
  assert.equal(isValidPincode('400001'), true);
  assert.equal(isValidPincode('110001'), true);
  assert.equal(isValidPincode('012345'), false); // Pincodes don't start with 0
  assert.equal(isValidPincode('40001'), false); // 5 digits
  assert.equal(isValidPincode('4000001'), false); // 7 digits
  assert.equal(isValidPincode(''), false);
});

test('isGstRequiredTreatment enforces GSTIN only for Registered Regular and Composition', () => {
  assert.equal(isGstRequiredTreatment('Registered Business - Regular'), true);
  assert.equal(isGstRequiredTreatment('Registered Business - Composition'), true);
  assert.equal(isGstRequiredTreatment('registered business - regular'), true);
  assert.equal(isGstRequiredTreatment('Registered Business - Composite'), true);

  // Unregistered businesses and Consumers do NOT require or possess GSTIN
  assert.equal(isGstRequiredTreatment('Unregistered Business'), false);
  assert.equal(isGstRequiredTreatment('unregistered business'), false);
  assert.equal(isGstRequiredTreatment('Consumer'), false);
  assert.equal(isGstRequiredTreatment('Consumers'), false);
  assert.equal(isGstRequiredTreatment('consumer'), false);
  assert.equal(isGstRequiredTreatment('Overseas'), false);
  assert.equal(isGstRequiredTreatment('Special Economic Zone'), false);
  assert.equal(isGstRequiredTreatment(''), false);
  assert.equal(isGstRequiredTreatment(null), false);
  assert.equal(isGstRequiredTreatment(undefined), false);
});

