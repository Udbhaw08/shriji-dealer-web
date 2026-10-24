# Zoho Commerce API Rate Limiting & Multi-Tier Caching

## Rate Limits
- Zoho Commerce limits requests per minute. Exceeding returns HTTP 429 Too Many Requests.
- The webstore uses an in-memory cache and a 3-minute localStorage cache (`CACHE_TTL_MS`).
- If Zoho returns 429 or network errors, the store automatically falls back to cached products to ensure zero downtime for catalog browsing.
