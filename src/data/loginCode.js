/**
 * Sunshine / ReStor User Categories & Standard Login Code Formats
 * 
 * Standard Format: <PREFIX>-<3 letters>-<4 digits>
 * Examples:
 * - Dealer: DE-IAK-2850 (prefix: DE)
 * - Store Staff: ST-KRT-1742 (prefix: ST)
 * - Brand Representative: BR-MXZ-6301 (prefix: BR)
 * - Retail Customer: RC-PTA-9026 (prefix: RC)
 */

export const USER_CATEGORIES = {
  dealer: {
    prefix: "DE",
    name: "Dealer",
    description: "Dealer or business owner",
    example: "DE-IAK-2850",
  },
  staff: {
    prefix: "ST",
    name: "Store Staff",
    description: "Employees working at a dealer's store",
    example: "ST-KRT-1742",
  },
  brand: {
    prefix: "BR",
    name: "Brand Representative",
    description: "Sunshine or other authorised brand representatives",
    example: "BR-MXZ-6301",
  },
  customer: {
    prefix: "RC",
    name: "Retail Customer",
    description: "Individual customers purchasing for personal use",
    example: "RC-PTA-9026",
  },
};

export const GST_TREATMENT_OPTIONS = [
  { value: "Registered Business - Regular", label: "Registered Business - Regular" },
  { value: "Registered Business - Composition", label: "Registered Business - Composition" },
  { value: "Unregistered Business", label: "Unregistered Business" },
  { value: "Consumer", label: "Consumer" },
  { value: "Overseas", label: "Overseas" },
  { value: "Special Economic Zone", label: "Special Economic Zone (SEZ)" },
  { value: "Deemed Export", label: "Deemed Export" },
];

export const PREFIX_MAP = {
  DE: "DE",
  ST: "ST",
  BR: "BR",
  RC: "RC",
  owner: "DE",
  dealer: "DE",
  staff: "ST",
  dealer_staff: "ST",
  brand: "BR",
  customer: "RC",
};

/**
 * Generate a standard code: <PREFIX>-<3 letters>-<4 digits>
 * Example: DE-IAK-2850
 */
export function generateLoginCode(categoryOrPrefix = "DE") {
  const prefix = PREFIX_MAP[categoryOrPrefix] || String(categoryOrPrefix || "DE").slice(0, 2).toUpperCase();
  const letters = Array.from({ length: 3 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${letters}-${digits}`;
}

/**
 * Normalizes input to <PREFIX>-<3 letters>-<4 digits> format.
 * Automatically inserts dashes if typed continuously (e.g. "DEIAK2850" -> "DE-IAK-2850").
 */
export function formatLoginCode(input) {
  if (!input) return "";
  const clean = String(input).trim().toUpperCase();

  // Already standard format
  if (/^[A-Z]{2}-[A-Z]{3}-\d{4}$/.test(clean)) {
    return clean;
  }

  // Without dashes (e.g. DEIAK2850)
  const noDashMatch = clean.match(/^([A-Z]{2})([A-Z]{3})(\d{4})$/);
  if (noDashMatch) {
    return `${noDashMatch[1]}-${noDashMatch[2]}-${noDashMatch[3]}`;
  }

  // Spaces or underscores
  const stripped = clean.replace(/[\s_]/g, "-");
  if (/^[A-Z]{2}-[A-Z]{3}-\d{4}$/.test(stripped)) {
    return stripped;
  }

  return clean;
}

/**
 * Validates against standard login code format: <PREFIX>-<3 letters>-<4 digits>
 */
export function isValidLoginCode(input) {
  if (!input) return false;
  const formatted = formatLoginCode(input);
  return /^[A-Z]{2}-[A-Z]{3}-\d{4}$/.test(formatted);
}
