# Supabase Database Schema Reference

## Primary Tables
- `users`: Authentication records, email, phone, role, and verification flags.
- `dealers`: Business profile, GSTIN, business name, verification status, and Zoho Pricebook ID.
- `dealer_staff`: Mapping between invited staff members and the dealer account.
- `invitations`: Secure time-limited tokens for staff onboarding.
- `otp_verifications`: SHA-256 hashed one-time passwords with expiration timestamps.
