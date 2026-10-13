import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdentifier } from '../src/routes/auth.js';

test('parseIdentifier correctly parses email addresses', () => {
  const result = parseIdentifier('Dealer.Store@Company.COM');
  assert.equal(result.email, 'dealer.store@company.com');
  assert.equal(result.phone, null);
});

test('parseIdentifier correctly parses mobile numbers with spaces and country codes', () => {
  const result1 = parseIdentifier('+91 98765 43210');
  assert.equal(result1.email, null);
  assert.equal(result1.phone, '+919876543210');

  const result2 = parseIdentifier('9876543210');
  assert.equal(result2.email, null);
  assert.equal(result2.phone, '9876543210');
});

test('parseIdentifier handles null or empty inputs cleanly', () => {
  const res1 = parseIdentifier('');
  assert.equal(res1.email, null);
  assert.equal(res1.phone, null);

  const res2 = parseIdentifier(null);
  assert.equal(res2.email, null);
  assert.equal(res2.phone, null);
});
