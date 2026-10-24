# Client Products Data Store

> 53 nodes · cohesion 0.06

## Key Concepts

- **server.js** (37 connections) — `backend/src/server.js`
- **pool.js** (30 connections) — `backend/src/db/pool.js`
- **catalog.js** (16 connections) — `backend/src/services/catalog.js`
- **env.js** (14 connections) — `backend/src/config/env.js`
- **env** (11 connections) — `backend/src/config/env.js`
- **index.js** (11 connections) — `backend/src/jobs/index.js`
- **catalogSync.js** (9 connections) — `backend/src/jobs/catalogSync.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
- **syncCatalog()** (7 connections) — `backend/src/services/catalog.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **prices.js** (6 connections) — `backend/src/routes/prices.js`
- **rateLimit.js** (5 connections) — `backend/src/middleware/rateLimit.js`
- **upload.js** (5 connections) — `backend/src/routes/upload.js`
- **uploads.js** (5 connections) — `backend/src/routes/uploads.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **rateLimit()** (4 connections) — `backend/src/middleware/rateLimit.js`
- **catalogFor()** (4 connections) — `backend/src/services/catalog.js`
- **loadCatalog()** (4 connections) — `backend/src/services/catalog.js`
- **applied()** (3 connections) — `backend/src/db/migrate.js`
- **catalogSync()** (3 connections) — `backend/src/jobs/catalogSync.js`
- **tokenCleanup()** (3 connections) — `backend/src/jobs/catalogSync.js`
- **startJobs()** (3 connections) — `backend/src/jobs/index.js`
- **migrate-content.js** (3 connections) — `backend/scripts/migrate-content.js`
- **test-storage.js** (3 connections) — `backend/scripts/test-storage.js`
- **priceView()** (3 connections) — `backend/src/services/catalog.js`
- *... and 28 more nodes in this community*

## Relationships

- [[Community 36]] (29 shared connections)
- [[Community 65]] (24 shared connections)
- [[Community 134]] (9 shared connections)
- [[Project Readme & Layout]] (7 shared connections)
- [[Community 46]] (4 shared connections)
- [[Community 96]] (4 shared connections)
- [[Community 392]] (1 shared connections)

## Source Files

- `backend/scripts/migrate-content.js`
- `backend/scripts/test-storage.js`
- `backend/src/config/env.js`
- `backend/src/db/migrate.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/catalogSync.js`
- `backend/src/jobs/index.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/rateLimit.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/content.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/health.js`
- `backend/src/routes/prices.js`
- `backend/src/routes/upload.js`
- `backend/src/routes/uploads.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/src/services/catalog.js`
- `backend/test/priceGate.test.mjs`

## Audit Trail

- EXTRACTED: 248 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*