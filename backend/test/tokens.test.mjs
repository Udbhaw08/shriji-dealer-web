import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-for-unit-tests';
process.env.NODE_ENV = 'test';
process.env.ENABLE_JOBS = 'false';
process.env.DATABASE_URL ||= 'postgres://placeholder:placeholder@localhost:5432/placeholder';

const { signAccessToken, verifyAccessToken } = await import('../src/services/tokens.js');
const jwt = (await import('jsonwebtoken')).default ?? (await import('jsonwebtoken'));

test('access token carries role, dealer_id and status claims', () => {
  const token = signAccessToken({
    id: '11111111-1111-1111-1111-111111111111',
    role: 'dealer',
    dealer_id: '22222222-2222-2222-2222-222222222222',
    status: 'active',
  });
  const claims = verifyAccessToken(token);
  assert.equal(claims.role, 'dealer');
  assert.equal(claims.dealer_id, '22222222-2222-2222-2222-222222222222');
  assert.equal(claims.status, 'active');
});

test('tampered tokens are rejected', () => {
  const token = signAccessToken({ id: 'x', role: 'customer', dealer_id: null, status: 'active' });
  assert.throws(() => verifyAccessToken(token + 'x'));
  assert.throws(() => jwt.verify(token, 'wrong-secret'));
});

test('expired tokens are rejected', async () => {
  const expired = jwt.sign({ sub: 'u1', role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '-10s' });
  assert.throws(() => verifyAccessToken(expired));
});
