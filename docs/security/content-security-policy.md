# Content Security Policy (CSP) Directives

## Directives
- `default-src 'self'`: Disallows unauthorized external resources.
- `img-src 'self' data: https://*.zohocdn.com https://restor.in`: Permits official media assets.
- `connect-src 'self' https://restor.in https://*.supabase.co`: Restricts API communication.
