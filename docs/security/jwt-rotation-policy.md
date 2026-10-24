# JWT Refresh Token Rotation Policy

## Rotation Rules
- Refresh tokens are single-use. Using a refresh token invalidates it and issues a replacement.
- Concurrent reuse of an already-consumed token triggers immediate session revocation.
- Refresh tokens are securely stored with SHA-256 hashes in the database.
