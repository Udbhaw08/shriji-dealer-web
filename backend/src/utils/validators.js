import { normalizePhone } from './phone.js';

/**
 * Standard RFC 5322 compliant email regex pattern with domain TLD requirement.
 * Rejects loose strings, missing @, missing domain, missing or invalid TLD.
 */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates whether an email string is a real, well-formed email address.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || clean.length > 254) return false;
  if (!EMAIL_REGEX.test(clean)) return false;

  const parts = clean.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain) return false;

  // Domain checks
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,24}$/.test(tld)) return false;

  return true;
}

/**
 * Normalizes email: trims, lowercases, and validates. Returns null if invalid.
 */
export function normalizeEmail(email) {
  if (!email) return null;
  const clean = String(email).trim().toLowerCase();
  return isValidEmail(clean) ? clean : null;
}

/**
 * Validates a 10-digit Indian mobile number.
 * Accepts digits only or phone with standard prefix.
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  const norm = normalizePhone(phone);
  if (!norm.nationalNumber || norm.nationalNumber.length !== 10) return false;
  // Indian mobile numbers start with 6, 7, 8, or 9
  return /^[6-9]\d{9}$/.test(norm.nationalNumber);
}

/**
 * Validates a person's name (First Name, Last Name).
 * Allows letters, spaces, dots, hyphens, and apostrophes (min 2 characters, max 60).
 */
export function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) return false;
  return /^[\p{L}\s.'-]+$/u.test(clean);
}

/**
 * Cleans and capitalizes names properly.
 */
export function cleanName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}

/**
 * Validates Indian GSTIN (Goods and Services Tax Identification Number):
 * 15 characters: 2 state digits + 10 PAN alphanumeric + 1 entity digit + 'Z' + 1 checksum char.
 */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export function isValidGstin(gstin) {
  if (!gstin) return false;
  return GSTIN_REGEX.test(String(gstin).trim().toUpperCase());
}

/**
 * Validates Indian 6-digit PIN code (postal code).
 */
export function isValidPincode(pin) {
  if (!pin) return false;
  return /^[1-9][0-9]{5}$/.test(String(pin).trim());
}
