/**
 * Safe HTML and Attribute Escaping Utility.
 * Prevents Reflected XSS and Attribute Injection in server-rendered templates.
 */

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeUrl(urlStr, allowedProtocols = ['http:', 'https:']) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    const trimmed = urlStr.trim();
    // Prevent javascript:, data:, vbscript: URIs
    const parsed = new URL(trimmed, 'https://restor.in');
    if (!allowedProtocols.includes(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

export function sanitizeHost(hostStr) {
  if (!hostStr || typeof hostStr !== 'string') return 'restor.in';
  const clean = hostStr.trim().toLowerCase();
  // Hostname must be alphanumeric with dashes, dots, and optional port
  if (/^[a-z0-9.-]+(:[0-9]+)?$/.test(clean) && !clean.includes('..')) {
    return clean;
  }
  return 'restor.in';
}
