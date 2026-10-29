# Architecture Doc Generator

> 52 nodes · cohesion 0.08

## Key Concepts

- **server.js** (39 connections) — `backend/src/server.js`
- **pool.js** (35 connections) — `backend/src/db/pool.js`
- **env.js** (17 connections) — `backend/src/config/env.js`
- **catalog.js** (16 connections) — `backend/src/services/catalog.js`
- **env** (14 connections) — `backend/src/config/env.js`
- **webhooks.js** (14 connections) — `backend/src/routes/webhooks.js`
- **logger.js** (14 connections) — `backend/src/utils/logger.js`
- **crmPoll.js** (13 connections) — `backend/src/jobs/crmPoll.js`
- **log** (13 connections) — `backend/src/utils/logger.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **index.js** (11 connections) — `backend/src/jobs/index.js`
- **catalogSync.js** (9 connections) — `backend/src/jobs/catalogSync.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
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
- *... and 27 more nodes in this community*

## Relationships

- [[Zoho Integration Skill]] (39 shared connections)
- [[Community 29]] (22 shared connections)
- [[Community 140]] (11 shared connections)
- [[Community 50]] (11 shared connections)
- [[Community 127]] (8 shared connections)
- [[Community 115]] (8 shared connections)
- [[Community 89]] (3 shared connections)
- [[Community 154]] (2 shared connections)
- [[Community 234]] (1 shared connections)
- [[Community 325]] (1 shared connections)
- [[Product Brand & Business Vision]] (1 shared connections)

## Source Files

- `backend/scripts/migrate-content.js`
- `backend/scripts/test-storage.js`
- `backend/src/config/env.js`
- `backend/src/db/migrate.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/catalogSync.js`
- `backend/src/jobs/crmPoll.js`
- `backend/src/jobs/index.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/health.js`
- `backend/src/routes/prices.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/src/services/catalog.js`
- `backend/src/services/dealerApp.js`
- `backend/src/utils/logger.js`
- `backend/test/crmSync.test.mjs`
- `backend/test/priceGate.test.mjs`

## Audit Trail

- EXTRACTED: 309 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*