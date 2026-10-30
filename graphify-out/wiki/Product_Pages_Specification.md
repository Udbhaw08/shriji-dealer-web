# Product Pages Specification

> 62 nodes · cohesion 0.06

## Key Concepts

- **server.js** (36 connections) — `backend/src/server.js`
- **app.js** (30 connections) — `backend/src/app.js`
- **compatibilitySuite.test.mjs** (20 connections) — `backend/test/compatibilitySuite.test.mjs`
- **env.js** (18 connections) — `backend/src/config/env.js`
- **securityPhase1.test.mjs** (16 connections) — `backend/test/securityPhase1.test.mjs`
- **env** (15 connections) — `backend/src/config/env.js`
- **webhooks.js** (15 connections) — `backend/src/routes/webhooks.js`
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
- **contentRouter** (5 connections) — `backend/src/routes/content.js`
- **uploadRouter** (5 connections) — `backend/src/routes/upload.js`
- **uploadsRouter** (5 connections) — `backend/src/routes/uploads.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **errorHandler()** (4 connections) — `backend/src/middleware/errorHandler.js`
- **adminRouter** (4 connections) — `backend/src/routes/admin.js`
- **app** (4 connections) — `backend/src/app.js`
- **rateLimitFix.test.mjs** (4 connections) — `backend/test/rateLimitFix.test.mjs`
- *... and 37 more nodes in this community*

## Relationships

- [[Pricing Regression Test Suite]] (33 shared connections)
- [[Community 45]] (21 shared connections)
- [[Community 50]] (15 shared connections)
- [[Community 43]] (9 shared connections)
- [[Community 116]] (6 shared connections)
- [[Community 51]] (5 shared connections)
- [[Community 92]] (4 shared connections)
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

- EXTRACTED: 333 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*