export class CacheManager {
  constructor(defaultTtlMs = 180000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtlMs;
  }

  set(key, val, ttl = this.defaultTtl) {
    this.cache.set(key, { val, expiry: Date.now() + ttl });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.val;
  }
}

export const globalCache = new CacheManager();
