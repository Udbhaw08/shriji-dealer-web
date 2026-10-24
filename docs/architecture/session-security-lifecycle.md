# Session Security Lifecycle & Token Rotation

## Token Lifecycles
- **Access Token**: Short-lived (15 minutes), signed with HS256 secret. Carries role, dealer ID, and status claims.
- **Refresh Token**: Long-lived (30 days), stored securely with SHA-256 hash in database.
- **Sliding Window**: Active use within 30 days automatically rotates and refreshes session tokens without forcing re-login.
