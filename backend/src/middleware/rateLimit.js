// Minimal in-memory sliding-window rate limiter. Good enough for one node;
// swap the store for Redis when the service scales horizontally.
// Disabled under NODE_ENV=test — the test suite would exhaust the shared
// per-IP budget across tests and fail spuriously.
const buckets = new Map(); // key → [timestamps]

export function rateLimit({ windowMs = 60_000, max = 30, keyFn = (req) => req.ip } = {}) {
  if (process.env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res.status(429).json({ error: 'rate_limited', retry_after_seconds: Math.ceil((arr[0] + windowMs - now) / 1000) });
    }
    arr.push(now);
    buckets.set(key, arr);
    if (buckets.size > 10_000) buckets.clear(); // crude memory bound
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
