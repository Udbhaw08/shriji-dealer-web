# Pricing Hierarchy & Zero-Leakage Spec

> 51 nodes · cohesion 0.07

## Key Concepts

- **server.js** (36 connections) — `backend/src/server.js`
- **app.js** (30 connections) — `backend/src/app.js`
- **compatibilitySuite.test.mjs** (20 connections) — `backend/test/compatibilitySuite.test.mjs`
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
- **[...path].js** (3 connections) — `api/auth/[...path].js`
- **applied()** (3 connections) — `backend/src/db/migrate.js`
- **[...path].js** (3 connections) — `api/dealers/[...path].js`
- **startJobs()** (3 connections) — `backend/src/jobs/index.js`
- *... and 26 more nodes in this community*

## Relationships

- [[Master Codebase Architecture Reference]] (29 shared connections)
- [[Community 49]] (13 shared connections)
- [[Client Products Data Store]] (13 shared connections)
- [[Oxlint Linter Configuration]] (12 shared connections)
- [[Community 91]] (4 shared connections)
- [[Zoho Integration Architecture]] (2 shared connections)

## Source Files

- `api/auth/[...path].js`
- `api/dealers/[...path].js`
- `backend/src/app.js`
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
- `backend/test/securityPhase3.test.mjs`

## Audit Trail

- EXTRACTED: 263 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*