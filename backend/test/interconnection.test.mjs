import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailOnlyIdentifier } from '../src/routes/auth.js';
import { normalizePhone } from '../src/utils/phone.js';

test('emailOnlyIdentifier rejects phone numbers and normalizes email login identifiers', () => {
  assert.equal(emailOnlyIdentifier('Dealer.Store@Company.COM'), 'dealer.store@company.com');
  assert.equal(emailOnlyIdentifier('+91 98765 43210'), null);
  assert.equal(emailOnlyIdentifier('9876543210'), null);
});

test('normalizePhone cleanly separates country code and 10-digit national number for Zoho CRM', () => {
  const n1 = normalizePhone('9876543210');
  assert.equal(n1.countryCode, '+91');
  assert.equal(n1.nationalNumber, '9876543210');
  assert.equal(n1.e164, '+919876543210');

  const n2 = normalizePhone('+91 98765 43210');
  assert.equal(n2.countryCode, '+91');
  assert.equal(n2.nationalNumber, '9876543210');
  assert.equal(n2.e164, '+919876543210');

  const n3 = normalizePhone('09876543210');
  assert.equal(n3.countryCode, '+91');
  assert.equal(n3.nationalNumber, '9876543210');

  const n4 = normalizePhone('919876543210');
  assert.equal(n4.countryCode, '+91');
  assert.equal(n4.nationalNumber, '9876543210');

  const nEmpty = normalizePhone('');
  assert.equal(nEmpty.nationalNumber, null);
  assert.equal(nEmpty.e164, null);
});

import { resolveContactNames } from '../src/services/crmClient.js';

test('resolveContactNames populates both First_Name and Last_Name without leaving front name empty', () => {
  // Case 1: Explicit first and last name provided (from the 2 separate form inputs)
  const res1 = resolveContactNames({ firstName: 'Rajesh', lastName: 'Sharma' });
  assert.equal(res1.firstName, 'Rajesh');
  assert.equal(res1.lastName, 'Sharma');

  // Case 2: Full person name provided
  const res2 = resolveContactNames({ personName: 'Amit Kumar Verma' });
  assert.equal(res2.firstName, 'Amit Kumar');
  assert.equal(res2.lastName, 'Verma');

  // Case 3: Single name provided — ensure First_Name is NEVER empty in Zoho CRM
  const res3 = resolveContactNames({ personName: 'Sunita' });
  assert.equal(res3.firstName, 'Sunita');
  assert.equal(res3.lastName, 'Sunita');

  // Case 4: Only last name provided
  const res4 = resolveContactNames({ lastName: 'Patel' });
  assert.equal(res4.firstName, 'Patel');
  assert.equal(res4.lastName, 'Patel');

  // Case 5: Empty input uses role default
  const res5 = resolveContactNames({ defaultLast: 'Dealer Owner' });
  assert.equal(res5.firstName, 'Dealer Owner');
  assert.equal(res5.lastName, 'Dealer Owner');
});

