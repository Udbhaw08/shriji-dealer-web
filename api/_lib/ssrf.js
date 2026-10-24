import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Legitimate hostnames approved for remote file fetching.
 * Only documented hosts genuinely used by the webstore are allowed.
 */
export const ALLOWED_REMOTE_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'doc-00-00-docs.googleusercontent.com',
  'commondatastorage.googleapis.com',
  'cdn.zohoecommerce.com',
  'cdn2.zohoecommerce.com',
  'restor.in',
  'www.restor.in',
  'shrijidomestic.com',
  'www.shrijidomestic.com',
]);

/**
 * Returns true if an IP address belongs to loopback, private, link-local,
 * multicast, reserved, or cloud-metadata address spaces.
 */
export function isPrivateOrReservedIp(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return true;

  const cleanIp = ipStr.trim();
  const version = net.isIP(cleanIp);
  if (!version) return true;

  if (version === 4) {
    const parts = cleanIp.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [b0, b1, b2, b3] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;

    // 10.0.0.0/8 (Private)
    if (b0 === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;

    // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure cloud metadata e.g. 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;

    // 172.16.0.0/12 (Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.0.0.0/24, 192.0.2.0/24 (IETF protocol assignments & TEST-NET-1)
    if (b0 === 192 && b1 === 0 && (b2 === 0 || b2 === 2)) return true;

    // 192.168.0.0/16 (Private)
    if (b0 === 192 && b1 === 168) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (b0 === 198 && b1 === 51 && b2 === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (b0 === 203 && b1 === 0 && b2 === 113) return true;

    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224 && b0 <= 239) return true;

    // 240.0.0.0/4 (Reserved)
    if (b0 >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

    return false;
  }

  if (version === 6) {
    const lower = cleanIp.toLowerCase();

    // Loopback (::1)
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

    // Unspecified (::)
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;

    // IPv4-mapped IPv6 (::ffff:192.0.2.128 or ::ffff:7f00:1)
    if (lower.startsWith('::ffff:')) {
      const v4Part = lower.slice(7);
      if (net.isIPv4(v4Part)) {
        return isPrivateOrReservedIp(v4Part);
      }
    }

    // Link-local unicast (fe80::/10)
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }

    // Unique local address / private (fc00::/7 -> fc00:: through fdff::)
    if (lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }

    // Multicast (ff00::/8)
    if (lower.startsWith('ff')) {
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Validates a candidate remote download URL against strict SSRF constraints.
 * Throws an Error with a safe message if the URL violates security boundaries.
 */
export async function validateSafeDownloadUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    throw new Error('Invalid URL provided');
  }

  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error('Malformed URL syntax');
  }

  // 1. Protocol check — strict https or http only
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }

  // 2. Disallow embedded credentials
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    throw new Error('Missing hostname');
  }

  // Direct IP in hostname check
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error(`Access to private or reserved IP address is forbidden: ${hostname}`);
    }
  }

  // 3. Allowlist check
  let isAllowed = ALLOWED_REMOTE_HOSTS.has(hostname);

  // Check Google Drive / Usercontent subdomains
  if (!isAllowed && (hostname.endsWith('.googleusercontent.com') || hostname.endsWith('.zohoecommerce.com'))) {
    isAllowed = true;
  }

  // Optional Supabase hostname from env
  const supabaseUrl = process.env.SUPABASE_URL || '';
  if (supabaseUrl) {
    try {
      const sbHost = new URL(supabaseUrl).hostname.toLowerCase();
      if (hostname === sbHost || (sbHost && hostname.endsWith(`.${sbHost}`))) {
        isAllowed = true;
      }
    } catch {}
  }

  if (!isAllowed) {
    throw new Error(`Hostname not permitted for remote download: ${hostname}`);
  }

  // 4. DNS Resolution & Rebinding Check
  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`Failed to resolve host: ${hostname}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`Host could not be resolved: ${hostname}`);
  }

  for (const record of addresses) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error(`Host resolved to private or reserved IP: ${record.address}`);
    }
  }

  return parsed;
}
