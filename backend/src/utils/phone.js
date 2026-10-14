/**
 * Utilities for parsing, sanitizing, and normalizing phone numbers and country codes.
 */

/**
 * Normalizes a phone number and country code into structured parts:
 * - countryCode: e.g. "+91"
 * - nationalNumber: e.g. "9876543210" (10-digit mobile number)
 * - e164: e.g. "+919876543210" (standardized format for DB and auth)
 * - formatted: e.g. "+91 98765 43210"
 */
export function normalizePhone(raw, defaultCountryCode = '+91') {
  if (!raw) {
    return {
      countryCode: defaultCountryCode,
      nationalNumber: null,
      e164: null,
      formatted: null,
    };
  }

  const str = String(raw).trim();
  const digitsOnly = str.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      countryCode: defaultCountryCode,
      nationalNumber: null,
      e164: null,
      formatted: null,
    };
  }

  let countryCode = defaultCountryCode ? (defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`) : '+91';
  let nationalNumber = digitsOnly;

  // Handle explicit country code prefix in input string
  if (str.startsWith('+91')) {
    countryCode = '+91';
    nationalNumber = digitsOnly.slice(2);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    countryCode = '+91';
    nationalNumber = digitsOnly.slice(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    // Leading 0 e.g. 09876543210
    countryCode = '+91';
    nationalNumber = digitsOnly.slice(1);
  } else if (digitsOnly.length >= 10) {
    // Standard 10 digit Indian mobile number
    nationalNumber = digitsOnly.slice(-10);
  }

  const e164 = nationalNumber ? `${countryCode}${nationalNumber}` : null;
  const formatted = nationalNumber && nationalNumber.length === 10
    ? `${countryCode} ${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`
    : e164;

  return {
    countryCode,
    nationalNumber,
    e164,
    formatted,
  };
}
