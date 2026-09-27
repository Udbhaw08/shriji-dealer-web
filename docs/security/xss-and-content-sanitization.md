# XSS Prevention & Content Sanitization Guidelines

## Guidelines
- All user-supplied fields (names, inquiries, feedback) MUST be sanitized before persistence.
- React automatically escapes JSX expressions; never use `dangerouslySetInnerHTML` without strict SVG/HTML sanitization.
- HTTP security headers (CSP, nosniff, XSS protection) are enforced on all server responses.
