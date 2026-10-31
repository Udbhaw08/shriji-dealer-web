# Product Requirements Documentation

> 61 nodes · cohesion 0.06

## Key Concepts

- **server.js** (36 connections) — `backend/src/server.js`
- **app.js** (31 connections) — `backend/src/app.js`
- **compatibilitySuite.test.mjs** (20 connections) — `backend/test/compatibilitySuite.test.mjs`
- **content.js** (17 connections) — `backend/src/routes/content.js`
- **securityPhase1.test.mjs** (16 connections) — `backend/test/securityPhase1.test.mjs`
- **upload.js** (12 connections) — `backend/src/routes/upload.js`
- **errorHandler.js** (10 connections) — `backend/src/middleware/errorHandler.js`
- **rateLimit.js** (10 connections) — `backend/src/middleware/rateLimit.js`
- **rateLimit()** (9 connections) — `backend/src/middleware/rateLimit.js`
- **admin.js** (9 connections) — `backend/src/routes/admin.js`
- **health.js** (9 connections) — `backend/src/routes/health.js`
- **uploads.js** (9 connections) — `backend/src/routes/uploads.js`
- **securityPhase3.test.mjs** (9 connections) — `backend/test/securityPhase3.test.mjs`
- **prices.js** (7 connections) — `backend/src/routes/prices.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **requireAdmin()** (5 connections) — `backend/src/middleware/auth.js`
- **contentRouter** (5 connections) — `backend/src/routes/content.js`
- **uploadRouter** (5 connections) — `backend/src/routes/upload.js`
- **uploadsRouter** (5 connections) — `backend/src/routes/uploads.js`
- **app** (5 connections) — `backend/src/app.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **errorHandler()** (4 connections) — `backend/src/middleware/errorHandler.js`
- **adminRouter** (4 connections) — `backend/src/routes/admin.js`
- **rateLimitFix.test.mjs** (4 connections) — `backend/test/rateLimitFix.test.mjs`
- **[...path].js** (3 connections) — `api/auth/[...path].js`
- *... and 36 more nodes in this community*

## Relationships

- [[Community 51]] (25 shared connections)
- [[Live Pricing Audit Tool]] (21 shared connections)
- [[Design System & UI Tokens]] (9 shared connections)
- [[Community 56]] (8 shared connections)
- [[Pricing Hierarchy & Zero-Leakage Spec]] (4 shared connections)
- [[Community 189]] (4 shared connections)
- [[Community 89]] (4 shared connections)
- [[Community 252]] (3 shared connections)
- [[Community 140]] (1 shared connections)

## Source Files

- `api/auth/[...path].js`
- `api/dealers/[...path].js`
- `api/webhooks/[...path].js`
- `backend/src/app.js`
- `backend/src/db/migrate.js`
- `backend/src/jobs/index.js`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/rateLimit.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/content.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/health.js`
- `backend/src/routes/prices.js`
- `backend/src/routes/upload.js`
- `backend/src/routes/uploads.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/test/compatibilitySuite.test.mjs`

## Audit Trail

- EXTRACTED: 311 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*