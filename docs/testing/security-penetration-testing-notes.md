# OWASP Top 10 Security Checklist

## Verified Protections
1. **Broken Access Control**: Role checks on every API route; strict dealer-owner permission checks.
2. **Cryptographic Failures**: Timing-safe HMAC OTP hashing; zero plaintext secrets in repositories.
3. **Injection**: Parameterized SQL queries via postgres driver; input sanitization on all text fields.
