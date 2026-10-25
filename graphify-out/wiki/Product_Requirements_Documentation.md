# Product Requirements Documentation

> 56 nodes · cohesion 0.06

## Key Concepts

- **server.js** (39 connections) — `backend/src/server.js`
- **pool.js** (34 connections) — `backend/src/db/pool.js`
- **compatibilitySuite.test.mjs** (20 connections) — `backend/test/compatibilitySuite.test.mjs`
- **env.js** (16 connections) — `backend/src/config/env.js`
- **securityPhase1.test.mjs** (16 connections) — `backend/test/securityPhase1.test.mjs`
- **webhooks.js** (14 connections) — `backend/src/routes/webhooks.js`
- **env** (13 connections) — `backend/src/config/env.js`
- **upload.js** (11 connections) — `backend/src/routes/upload.js`
- **admin.js** (8 connections) — `backend/src/routes/admin.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
- **uploads.js** (8 connections) — `backend/src/routes/uploads.js`
- **rateLimit.js** (7 connections) — `backend/src/middleware/rateLimit.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **rateLimit()** (6 connections) — `backend/src/middleware/rateLimit.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **contentRouter** (4 connections) — `backend/src/routes/content.js`
- **uploadRouter** (4 connections) — `backend/src/routes/upload.js`
- **uploadsRouter** (4 connections) — `backend/src/routes/uploads.js`
- **applied()** (3 connections) — `backend/src/db/migrate.js`
- **startJobs()** (3 connections) — `backend/src/jobs/index.js`
- **adminRouter** (3 connections) — `backend/src/routes/admin.js`
- **migrate-content.js** (3 connections) — `backend/scripts/migrate-content.js`
- **test-storage.js** (3 connections) — `backend/scripts/test-storage.js`
- **start()** (3 connections) — `backend/src/server.js`
- **authRouter** (2 connections) — `backend/src/routes/auth.js`
- *... and 31 more nodes in this community*

## Relationships

- [[Community 31]] (30 shared connections)
- [[Product Brand & Business Vision]] (18 shared connections)
- [[Community 104]] (17 shared connections)
- [[Community 71]] (9 shared connections)
- [[Community 91]] (6 shared connections)
- [[Community 187]] (5 shared connections)
- [[Community 233]] (5 shared connections)
- [[Community 253]] (3 shared connections)
- [[Community 149]] (2 shared connections)
- [[Community 402]] (1 shared connections)

## Source Files

- `backend/scripts/migrate-content.js`
- `backend/scripts/test-storage.js`
- `backend/src/config/env.js`
- `backend/src/db/migrate.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/index.js`
- `backend/src/middleware/rateLimit.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/content.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/health.js`
- `backend/src/routes/upload.js`
- `backend/src/routes/uploads.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/test/compatibilitySuite.test.mjs`
- `backend/test/securityPhase1.test.mjs`

## Audit Trail

- EXTRACTED: 276 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*