# Rate Limiting Strategies & Brute-Force Defense

## Security Thresholds
- **OTP Request Rate Limit**: Max 3 OTP requests per phone number per 15 minutes.
- **OTP Verification Rate Limit**: Max 5 incorrect attempts before automatic invalidation.
- **Selective LRU Eviction**: Memory-safe cache pruning that protects active user buckets from starvation.
