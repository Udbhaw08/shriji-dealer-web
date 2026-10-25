# Roles & Customer Sharing Spec

> 51 nodes · cohesion 0.06

## Key Concepts

- **server.js** (39 connections) — `backend/src/server.js`
- **compatibilitySuite.test.mjs** (20 connections) — `backend/test/compatibilitySuite.test.mjs`
- **securityPhase1.test.mjs** (16 connections) — `backend/test/securityPhase1.test.mjs`
- **upload.js** (11 connections) — `backend/src/routes/upload.js`
- **upload.js** (9 connections) — `api/upload.js`
- **verifyAdminAuth()** (9 connections) — `api/_lib/adminAuth.js`
- **admin.js** (8 connections) — `backend/src/routes/admin.js`
- **health.js** (8 connections) — `backend/src/routes/health.js`
- **uploads.js** (8 connections) — `backend/src/routes/uploads.js`
- **migrate.js** (6 connections) — `backend/src/db/migrate.js`
- **adminAuth.js** (6 connections) — `api/_lib/adminAuth.js`
- **prices.js** (6 connections) — `backend/src/routes/prices.js`
- **handler()** (4 connections) — `api/upload.js`
- **migrate()** (4 connections) — `backend/src/db/migrate.js`
- **contentRouter** (4 connections) — `backend/src/routes/content.js`
- **uploadRouter** (4 connections) — `backend/src/routes/upload.js`
- **uploadsRouter** (4 connections) — `backend/src/routes/uploads.js`
- **login.js** (3 connections) — `api/admin/login.js`
- **applied()** (3 connections) — `backend/src/db/migrate.js`
- **startJobs()** (3 connections) — `backend/src/jobs/index.js`
- **adminRouter** (3 connections) — `backend/src/routes/admin.js`
- **start()** (3 connections) — `backend/src/server.js`
- **handler()** (2 connections) — `api/admin/login.js`
- **validateMagicBytes()** (2 connections) — `api/upload.js`
- **dealersRouter** (2 connections) — `backend/src/routes/dealers.js`
- *... and 26 more nodes in this community*

## Relationships

- [[Client Products Data Store]] (26 shared connections)
- [[Community 42]] (12 shared connections)
- [[Community 78]] (8 shared connections)
- [[Community 89]] (7 shared connections)
- [[Community 196]] (4 shared connections)
- [[Community 147]] (3 shared connections)
- [[Zoho Integration Skill]] (2 shared connections)

## Source Files

- `api/_lib/adminAuth.js`
- `api/admin/login.js`
- `api/upload.js`
- `backend/src/db/migrate.js`
- `backend/src/jobs/index.js`
- `backend/src/routes/admin.js`
- `backend/src/routes/content.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/health.js`
- `backend/src/routes/prices.js`
- `backend/src/routes/upload.js`
- `backend/src/routes/uploads.js`
- `backend/src/routes/webhooks.js`
- `backend/src/server.js`
- `backend/test/compatibilitySuite.test.mjs`
- `backend/test/securityPhase1.test.mjs`

## Audit Trail

- EXTRACTED: 216 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*