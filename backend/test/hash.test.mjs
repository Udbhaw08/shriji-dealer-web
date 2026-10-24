import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, sha256, hashOtp, verifyOtpHash, generateCode, generateOtp, randomToken } from '../src/utils/hash.js';

test('password hash round-trips and rejects wrong passwords', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('verifyPassword survives malformed stored hashes', async () => {
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', ''), false);
  assert.equal(await verifyPassword('x', 'bcrypt$abc$def'), false);
});

test('same password hashes differently (per-user salt)', async () => {
  const a = await hashPassword('same-password');
  const b = await hashPassword('same-password');
  assert.notEqual(a, b);
});

test('sha256 is deterministic hex', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.equal(sha256('abc').length, 64);
  assert.match(sha256('abc'), /^[0-9a-f]{64}$/);
});

test('generateCode uses the unambiguous alphabet', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateCode(8);
    assert.equal(code.length, 8);
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  }
});

test('generateOtp is 6 digits', () => {
  for (let i = 0; i < 50; i++) assert.match(generateOtp(), /^\d{6}$/);
});

test('randomToken is url-safe and unique', () => {
  assert.notEqual(randomToken(), randomToken());
  assert.match(randomToken(), /^[A-Za-z0-9_-]+$/);
});

test('hashOtp and verifyOtpHash verify HMAC-SHA256 and fallback to plain SHA256', () => {
  const code = '123456';
  const ident = '9876543210';
  const hmacHash = hashOtp(code, ident);
  assert.equal(hmacHash.length, 64);
  assert.equal(verifyOtpHash(code, hmacHash, ident), true);
  assert.equal(verifyOtpHash('000000', hmacHash, ident), false);
  assert.equal(verifyOtpHash(code, hmacHash, 'different-ident'), false);

  // Backward compatibility test with plain SHA-256
  const legacyHash = sha256(code);
  assert.equal(verifyOtpHash(code, legacyHash, ident), true);
  assert.equal(verifyOtpHash('000000', legacyHash, ident), false);
});
