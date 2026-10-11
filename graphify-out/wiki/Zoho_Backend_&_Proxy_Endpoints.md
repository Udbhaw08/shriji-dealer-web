# Zoho Backend & Proxy Endpoints

> 106 nodes · cohesion 0.06

## Key Concepts

- **sql** (35 connections) — `backend/src/db/pool.js`
- **auth.js** (32 connections) — `backend/src/routes/auth.js`
- **server.js** (25 connections) — `backend/src/server.js`
- **crmClient.js** (21 connections) — `backend/src/services/crmClient.js`
- **dealers.js** (20 connections) — `backend/src/routes/dealers.js`
- **staff.js** (18 connections) — `backend/src/services/staff.js`
- **pool.js** (17 connections) — `backend/src/db/pool.js`
- **catalog.js** (16 connections) — `backend/src/services/catalog.js`
- **audit()** (14 connections) — `backend/src/utils/audit.js`
- **logger.js** (14 connections) — `backend/src/utils/logger.js`
- **env.js** (13 connections) — `backend/src/config/env.js`
- **webhooks.js** (13 connections) — `backend/src/routes/webhooks.js`
- **log** (13 connections) — `backend/src/utils/logger.js`
- **crmPoll.js** (12 connections) — `backend/src/jobs/crmPoll.js`
- **dealerApp.js** (12 connections) — `backend/src/services/dealerApp.js`
- **env** (11 connections) — `backend/src/config/env.js`
- **index.js** (11 connections) — `backend/src/jobs/index.js`
- **commerceClient.js** (11 connections) — `backend/src/services/commerceClient.js`
- **hash.js** (11 connections) — `backend/src/utils/hash.js`
- **catalogSync.js** (9 connections) — `backend/src/jobs/catalogSync.js`
- **notifications.js** (9 connections) — `backend/src/services/notifications.js`
- **auth.js** (8 connections) — `backend/src/middleware/auth.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
- **crmFetch()** (8 connections) — `backend/src/services/crmClient.js`
- **errorHandler.js** (7 connections) — `backend/src/middleware/errorHandler.js`
- *... and 81 more nodes in this community*

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

- EXTRACTED: 614 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*