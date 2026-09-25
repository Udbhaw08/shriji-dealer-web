# REST API Endpoints Specification

## Authentication Endpoints
- `POST /api/auth/otp/request`: Requests WhatsApp / SMS OTP for phone verification.
- `POST /api/auth/otp/verify`: Verifies OTP and returns JWT tokens.
- `POST /api/auth/token/refresh`: Rotates refresh token and issues new access token.
- `GET /api/auth/me`: Returns authenticated user profile and dealer details.

## Catalog Endpoints
- `GET /api/products`: Returns product list with role-masked rates.
- `GET /api/products/:id`: Returns full product specifications and high-res media.
