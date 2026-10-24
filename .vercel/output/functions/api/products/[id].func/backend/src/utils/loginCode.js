import crypto from 'node:crypto';

/**
 * Standard login code format: <PREFIX>-<3 letters>-<4 digits>
 * Example: DE-ABC-1234, DE-IAK-2850, ST-KRT-1742, BR-MXZ-6301, RC-PTA-9026
 */

export const USER_CATEGORIES = {
  dealer: {
    prefix: 'DE',
    name: 'Dealer',
    description: 'Dealer or business owner',
    example: 'DE-IAK-2850',
  },
  staff: {
    prefix: 'ST',
    name: 'Store Staff',
    description: "Employees working at a dealer's store",
    example: 'ST-KRT-1742',
  },
  dealer_staff: {
    prefix: 'ST',
    name: 'Store Staff',
    description: "Employees working at a dealer's store",
    example: 'ST-KRT-1742',
  },
  brand: {
    prefix: 'BR',
    name: 'Brand Representative',
    description: 'Sunshine or other authorised brand representatives',
    example: 'BR-MXZ-6301',
  },
  customer: {
    prefix: 'RC',
    name: 'Retail Customer',
    description: 'Individual customers purchasing for personal use',
    example: 'RC-PTA-9026',
  },
};

export const GST_TREATMENT_OPTIONS = [
  { value: 'Registered Business - Regular', label: 'Registered Business - Regular' },
  { value: 'Registered Business - Composition', label: 'Registered Business - Composition' },
  { value: 'Unregistered Business', label: 'Unregistered Business' },
  { value: 'Consumer', label: 'Consumer' },
  { value: 'Overseas', label: 'Overseas' },
  { value: 'Special Economic Zone', label: 'Special Economic Zone (SEZ)' },
  { value: 'Deemed Export', label: 'Deemed Export' },
];

export const PREFIX_MAP = {
  DE: 'DE',
  ST: 'ST',
  BR: 'BR',
  RC: 'RC',
  dealer: 'DE',
  staff: 'ST',
  dealer_staff: 'ST',
  brand: 'BR',
  brand_representative: 'BR',
  customer: 'RC',
  retail_customer: 'RC',
};

const LETTERS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generates 3 cryptographically random uppercase letters (A-Z).
 */
export function generateRandomLetters(count = 3) {
  const bytes = crypto.randomBytes(count);
  let out = '';
  for (let i = 0; i < count; i++) {
    out += LETTERS_ALPHABET[bytes[i] % LETTERS_ALPHABET.length];
  }
  return out;
}

/**
 * Generates 4 cryptographically random numeric digits (0000-9999 or 1000-9999).
 */
export function generateRandomDigits(count = 4) {
  // 4 random digits (0000-9999)
  const max = 10 ** count;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(count, '0');
}

/**
 * Generate a standard code: <PREFIX>-<3 letters>-<4 digits>
 * @param {string} categoryOrPrefix - 'DE' | 'ST' | 'BR' | 'RC' | role name (default 'DE')
 * @returns {string} e.g. 'DE-IAK-2850'
 */
export function generateLoginCode(categoryOrPrefix = 'DE') {
  const prefix = PREFIX_MAP[categoryOrPrefix] || String(categoryOrPrefix || 'DE').slice(0, 2).toUpperCase();
  const letters = generateRandomLetters(3);
  const digits = generateRandomDigits(4);
  return `${prefix}-${letters}-${digits}`;
}

/**
 * Normalizes and formats code to standard format: <PREFIX>-<3 letters>-<4 digits>.
 * Handles user input with or without dashes (e.g. "deiak2850" -> "DE-IAK-2850").
 */
export function formatLoginCode(input) {
  if (!input) return '';
  const clean = String(input).trim().toUpperCase();

  // If already in XX-XXX-XXXX format
  if (/^[A-Z]{2}-[A-Z]{3}-\d{4}$/.test(clean)) {
    return clean;
  }

  // If entered without dashes (e.g. DEIAK2850)
  const noDashMatch = clean.match(/^([A-Z]{2})([A-Z]{3})(\d{4})$/);
  if (noDashMatch) {
    return `${noDashMatch[1]}-${noDashMatch[2]}-${noDashMatch[3]}`;
  }

  // If entered with irregular dashes/spaces (e.g. "DE IAK 2850" or "DE_IAK_2850")
  const stripped = clean.replace(/[\s_]/g, '-');
  if (/^[A-Z]{2}-[A-Z]{3}-\d{4}$/.test(stripped)) {
    return stripped;
  }

  return clean;
}

/**
 * Validates whether the given code matches the standard format:
 * 2-letter prefix + hyphen + 3 uppercase letters + hyphen + 4 digits
 */
export function isValidLoginCode(input) {
  if (!input) return false;
  const formatted = formatLoginCode(input);
  return /^[A-Z]{2}-[A-Z]{3}-\d{4}$/.test(formatted);
}

/**
 * Parses a code into its prefix, letters, and digits components.
 */
export function parseLoginCode(input) {
  const formatted = formatLoginCode(input);
  const match = formatted.match(/^([A-Z]{2})-([A-Z]{3})-(\d{4})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    letters: match[2],
    digits: match[3],
    formatted,
  };
}

/**
 * Generates a unique, collision-free dealer code in the database.
 */
export async function generateUniqueDealerCode(sql, prefix = 'DE') {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateLoginCode(prefix);
    const existing = await sql`select id from dealers where lower(dealer_code) = lower(${candidate}) limit 1`;
    if (!existing.length) {
      return candidate;
    }
  }
  // Fallback if somehow 10 collisions occurred
  return generateLoginCode(prefix);
}
