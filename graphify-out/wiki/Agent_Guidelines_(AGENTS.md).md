# Agent Guidelines (AGENTS.md)

> 43 nodes · cohesion 0.09

## Key Concepts

- **server.js** (39 connections) — `backend/src/server.js`
- **pool.js** (34 connections) — `backend/src/db/pool.js`
- **env.js** (17 connections) — `backend/src/config/env.js`
- **env** (14 connections) — `backend/src/config/env.js`
- **webhooks.js** (14 connections) — `backend/src/routes/webhooks.js`
- **logger.js** (14 connections) — `backend/src/utils/logger.js`
- **crmPoll.js** (13 connections) — `backend/src/jobs/crmPoll.js`
- **log** (13 connections) — `backend/src/utils/logger.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **index.js** (11 connections) — `backend/src/jobs/index.js`
- **catalogSync.js** (9 connections) — `backend/src/jobs/catalogSync.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **crmPoll()** (5 connections) — `backend/src/jobs/crmPoll.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **applied()** (3 connections) — `backend/src/db/migrate.js`
- **catalogSync()** (3 connections) — `backend/src/jobs/catalogSync.js`
- **tokenCleanup()** (3 connections) — `backend/src/jobs/catalogSync.js`
- **markPollRun()** (3 connections) — `backend/src/jobs/crmPoll.js`
- **startJobs()** (3 connections) — `backend/src/jobs/index.js`
- **migrate-content.js** (3 connections) — `backend/scripts/migrate-content.js`
- **test-storage.js** (3 connections) — `backend/scripts/test-storage.js`
- **start()** (3 connections) — `backend/src/server.js`
- **authRouter** (2 connections) — `backend/src/routes/auth.js`
- **dealersRouter** (2 connections) — `backend/src/routes/dealers.js`
- *... and 18 more nodes in this community*

## Relationships

- [[Mobile Responsive UI Skill]] (35 shared connections)
- [[Community 36]] (22 shared connections)
- [[Community 75]] (16 shared connections)
- [[Community 53]] (11 shared connections)
- [[Community 111]] (8 shared connections)
- [[Community 114]] (8 shared connections)
- [[Community 91]] (3 shared connections)
- [[Community 152]] (2 shared connections)
- [[Community 199]] (1 shared connections)

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
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/src/services/dealerApp.js`
- `backend/src/utils/logger.js`
- `backend/test/crmSync.test.mjs`

## Audit Trail

- EXTRACTED: 262 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*