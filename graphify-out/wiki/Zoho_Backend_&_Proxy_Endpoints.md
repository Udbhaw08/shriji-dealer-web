# Zoho Backend & Proxy Endpoints

> 97 nodes · cohesion 0.06

## Key Concepts

- **sql** (30 connections) — `backend/src/db/pool.js`
- **server.js** (25 connections) — `backend/src/server.js`
- **auth.js** (22 connections) — `backend/src/routes/auth.js`
- **pool.js** (17 connections) — `backend/src/db/pool.js`
- **crmClient.js** (17 connections) — `backend/src/services/crmClient.js`
- **catalog.js** (16 connections) — `backend/src/services/catalog.js`
- **dealers.js** (15 connections) — `backend/src/routes/dealers.js`
- **staff.js** (14 connections) — `backend/src/services/staff.js`
- **webhooks.js** (13 connections) — `backend/src/routes/webhooks.js`
- **logger.js** (13 connections) — `backend/src/utils/logger.js`
- **crmPoll.js** (12 connections) — `backend/src/jobs/crmPoll.js`
- **dealerApp.js** (12 connections) — `backend/src/services/dealerApp.js`
- **log** (12 connections) — `backend/src/utils/logger.js`
- **env.js** (11 connections) — `backend/src/config/env.js`
- **index.js** (11 connections) — `backend/src/jobs/index.js`
- **commerceClient.js** (11 connections) — `backend/src/services/commerceClient.js`
- **audit()** (11 connections) — `backend/src/utils/audit.js`
- **hash.js** (11 connections) — `backend/src/utils/hash.js`
- **env** (9 connections) — `backend/src/config/env.js`
- **catalogSync.js** (9 connections) — `backend/src/jobs/catalogSync.js`
- **auth.js** (8 connections) — `backend/src/middleware/auth.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
- **errorHandler.js** (7 connections) — `backend/src/middleware/errorHandler.js`
- **syncCatalog()** (7 connections) — `backend/src/services/catalog.js`
- **crmFetch()** (7 connections) — `backend/src/services/crmClient.js`
- *... and 72 more nodes in this community*

## Relationships

- No strong cross-community connections detected

## Source Files

- `backend/src/config/env.js`
- `backend/src/db/migrate.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/catalogSync.js`
- `backend/src/jobs/crmPoll.js`
- `backend/src/jobs/index.js`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/rateLimit.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/health.js`
- `backend/src/routes/prices.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/src/services/catalog.js`
- `backend/src/services/commerceClient.js`
- `backend/src/services/crmClient.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/notifications.js`

## Audit Trail

- EXTRACTED: 542 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*