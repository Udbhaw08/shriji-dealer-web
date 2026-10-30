# Product Pages Specification

> 61 nodes · cohesion 0.06

## Key Concepts

- **server.js** (36 connections) — `backend/src/server.js`
- **app.js** (30 connections) — `backend/src/app.js`
- **compatibilitySuite.test.mjs** (20 connections) — `backend/test/compatibilitySuite.test.mjs`
- **env.js** (18 connections) — `backend/src/config/env.js`
- **securityPhase1.test.mjs** (16 connections) — `backend/test/securityPhase1.test.mjs`
- **env** (15 connections) — `backend/src/config/env.js`
- **webhooks.js** (15 connections) — `backend/src/routes/webhooks.js`
- **upload.js** (12 connections) — `backend/src/routes/upload.js`
- **rateLimit.js** (10 connections) — `backend/src/middleware/rateLimit.js`
- **rateLimit()** (9 connections) — `backend/src/middleware/rateLimit.js`
- **admin.js** (9 connections) — `backend/src/routes/admin.js`
- **health.js** (9 connections) — `backend/src/routes/health.js`
- **uploads.js** (9 connections) — `backend/src/routes/uploads.js`
- **securityPhase3.test.mjs** (9 connections) — `backend/test/securityPhase3.test.mjs`
- **prices.js** (7 connections) — `backend/src/routes/prices.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **contentRouter** (5 connections) — `backend/src/routes/content.js`
- **uploadRouter** (5 connections) — `backend/src/routes/upload.js`
- **uploadsRouter** (5 connections) — `backend/src/routes/uploads.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **errorHandler()** (4 connections) — `backend/src/middleware/errorHandler.js`
- **adminRouter** (4 connections) — `backend/src/routes/admin.js`
- **app** (4 connections) — `backend/src/app.js`
- **rateLimitFix.test.mjs** (4 connections) — `backend/test/rateLimitFix.test.mjs`
- **[...path].js** (3 connections) — `api/auth/[...path].js`
- *... and 36 more nodes in this community*

## Relationships

- [[Live Pricing Audit Tool]] (32 shared connections)
- [[Community 47]] (23 shared connections)
- [[Master Codebase Architecture Reference]] (17 shared connections)
- [[Community 164]] (6 shared connections)
- [[Community 72]] (5 shared connections)
- [[Community 90]] (4 shared connections)
- [[Community 188]] (4 shared connections)
- [[Client Products Data Store]] (2 shared connections)

## Source Files

- `api/auth/[...path].js`
- `api/dealers/[...path].js`
- `backend/src/app.js`
- `backend/src/config/env.js`
- `backend/src/db/migrate.js`
- `backend/src/jobs/index.js`
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
- `backend/test/rateLimitFix.test.mjs`

## Audit Trail

- EXTRACTED: 323 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*