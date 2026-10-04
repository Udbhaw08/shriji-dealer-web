import crypto from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scryptKey(password, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scryptKey(password, salt, Number(N), Number(r), Number(p));
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

function scryptKey(password, salt, N = SCRYPT.N, r = SCRYPT.r, p = SCRYPT.p) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N, r, p }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export const sha256 = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I,L,O,0,1 — human-safe

export function generateCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function generateOtp() {
  // 6-digit numeric, cryptographically random
  return String(crypto.randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
}
