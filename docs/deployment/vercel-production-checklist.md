# Vercel Production Deployment Checklist

## Environment Variables
- `DATABASE_URL`: Supabase pooled connection string (port 6543 / PgBouncer mode).
- `JWT_SECRET`: High-entropy 64-character HMAC secret key.
- `META_WHATSAPP_TOKEN`: Meta Cloud API System User access token.
- `RESEND_API_KEY`: Resend transactional email API key.
- `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`: Zoho Commerce OAuth credentials.
