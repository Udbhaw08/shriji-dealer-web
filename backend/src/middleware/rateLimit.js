// Sliding-window in-memory rate limiter with namespace isolation.
// Automatically resolves real client IPs behind Cloudflare and Render reverse proxies.
const buckets = new Map(); // key → [timestamps]

/**
 * Extract true client IP, prioritizing Cloudflare and standard reverse proxy headers.
 */
export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  const cf = req.headers?.['cf-connecting-ip'];
  if (cf) return (Array.isArray(cf) ? cf[0] : cf).split(',')[0].trim();
  const real = req.headers?.['x-real-ip'];
  if (real) return (Array.isArray(real) ? real[0] : real).split(',')[0].trim();
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) {
    const val = Array.isArray(fwd) ? fwd[0] : fwd;
    return val.split(',')[0].trim();
  }
  try {
    return (req.socket?.remoteAddress && req.ip) || req.socket?.remoteAddress || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

export function rateLimit({
  windowMs = 60_000,
  max = 30,
  prefix = 'rl',
  keyFn = (req) => getClientIp(req),
  message = 'Too many requests. Please wait a moment before trying again.',
} = {}) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test' && process.env.TEST_RATE_LIMIT !== 'true') {
      return next();
    }
    const configuredMax = typeof max === 'function' ? max() : max;
    const configuredWindowMs = typeof windowMs === 'function' ? windowMs() : windowMs;
    const effectiveMax = process.env.TEST_RATE_LIMIT === 'true' ? configuredMax : (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' ? Math.max(configuredMax, 500) : configuredMax);
    const rawKey = keyFn(req);
    const key = `${prefix}:${rawKey}`;
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter((t) => now - t < configuredWindowMs);
    if (arr.length >= effectiveMax) {
      const retryAfter = Math.ceil((arr[0] + configuredWindowMs - now) / 1000);
      return res.status(429).json({
        error: 'rate_limited',
        message,
        retry_after_seconds: retryAfter,
      });
    }
    arr.push(now);
    buckets.set(key, arr);
    if (buckets.size > 10_000) {
      // Evict oldest 20% of entries to bound memory without clearing all users' limits
      let toRemove = Math.floor(buckets.size * 0.2);
      for (const oldestKey of buckets.keys()) {
        buckets.delete(oldestKey);
        if (--toRemove <= 0) break;
      }
    }
    next();
  };
}

// Sweep old buckets so long-running processes don't accumulate dead keys
setInterval(() => {
  const now = Date.now();
  for (const [key, arr] of buckets) {
    const alive = arr.filter((t) => now - t < 10 * 60_000);
    if (alive.length) buckets.set(key, alive);
    else buckets.delete(key);
  }
}, 10 * 60_000).unref();

