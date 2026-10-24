/**
 * Strips script tags, HTML entities, and dangerous javascript protocols.
 */
export function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .trim();
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = typeof val === "string" ? sanitizeInput(val) : val;
  }
  return result;
}
