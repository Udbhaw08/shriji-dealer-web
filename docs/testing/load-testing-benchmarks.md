# Autocannon Load Test Benchmarks

## Targets
- `GET /api/products`: < 50ms latency (served from memory / disk cache).
- `POST /api/auth/otp/verify`: < 120ms latency including database query and JWT signing.
