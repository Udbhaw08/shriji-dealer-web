/**
 * Production frontend validation utilities matching backend constraints.
 */

export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || clean.length > 254) return false;
  if (!EMAIL_REGEX.test(clean)) return false;

  const parts = clean.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain) return false;

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1];
  return Boolean(tld && tld.length >= 2 && /^[a-zA-Z]{2,24}$/.test(tld));
}

export function isValidPhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
}

export function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  return clean.length >= 2 && clean.length <= 60 && /^[\p{L}\s.'-]+$/u.test(clean);
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(gstin) {
  if (!gstin) return false;
  return GSTIN_REGEX.test(String(gstin).trim().toUpperCase());
}

export function isValidPincode(pin) {
  if (!pin) return false;
  return /^[1-9][0-9]{5}$/.test(String(pin).trim());
}
