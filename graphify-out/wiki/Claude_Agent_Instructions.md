# Claude Agent Instructions

> 45 nodes · cohesion 0.10

## Key Concepts

- **server.js** (31 connections) — `backend/src/server.js`
- **pool.js** (18 connections) — `backend/src/db/pool.js`
- **catalog.js** (16 connections) — `backend/src/services/catalog.js`
- **webhooks.js** (14 connections) — `backend/src/routes/webhooks.js`
- **logger.js** (14 connections) — `backend/src/utils/logger.js`
- **env.js** (13 connections) — `backend/src/config/env.js`
- **crmPoll.js** (13 connections) — `backend/src/jobs/crmPoll.js`
- **log** (13 connections) — `backend/src/utils/logger.js`
- **env** (11 connections) — `backend/src/config/env.js`
- **index.js** (11 connections) — `backend/src/jobs/index.js`
- **catalogSync.js** (9 connections) — `backend/src/jobs/catalogSync.js`
- **notifications.js** (9 connections) — `backend/src/services/notifications.js`
- **errorHandler.js** (7 connections) — `backend/src/middleware/errorHandler.js`
- **syncCatalog()** (7 connections) — `backend/src/services/catalog.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **prices.js** (6 connections) — `backend/src/routes/prices.js`
- **crmPoll()** (5 connections) — `backend/src/jobs/crmPoll.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **catalogFor()** (4 connections) — `backend/src/services/catalog.js`
- **loadCatalog()** (4 connections) — `backend/src/services/catalog.js`
- **applied()** (3 connections) — `backend/src/db/migrate.js`
- **catalogSync()** (3 connections) — `backend/src/jobs/catalogSync.js`
- **tokenCleanup()** (3 connections) — `backend/src/jobs/catalogSync.js`
- **markPollRun()** (3 connections) — `backend/src/jobs/crmPoll.js`
- **startJobs()** (3 connections) — `backend/src/jobs/index.js`
- *... and 20 more nodes in this community*

## Relationships

- [[Community 51]] (36 shared connections)
- [[Community 49]] (15 shared connections)
- [[Community 95]] (11 shared connections)
- [[Community 101]] (6 shared connections)

## Source Files

- `backend/src/config/env.js`
- `backend/src/db/migrate.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/catalogSync.js`
- `backend/src/jobs/crmPoll.js`
- `backend/src/jobs/index.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/prices.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/src/services/catalog.js`
- `backend/src/services/notifications.js`
- `backend/src/utils/logger.js`
- `backend/test/priceGate.test.mjs`

## Audit Trail

- EXTRACTED: 262 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*