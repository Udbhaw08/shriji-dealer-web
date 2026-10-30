# Live Pricing Audit Tool

> 55 nodes · cohesion 0.08

## Key Concepts

- **sql** (82 connections) — `backend/src/db/pool.js`
- **dealers.js** (51 connections) — `backend/src/routes/dealers.js`
- **pool.js** (36 connections) — `backend/src/db/pool.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **auth.js** (13 connections) — `backend/src/middleware/auth.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
- **requireAdmin()** (5 connections) — `backend/src/middleware/auth.js`
- **seed-content.js** (4 connections) — `backend/scripts/seed-content.js`
- **deactivateDealer()** (4 connections) — `backend/src/services/dealerApp.js`
- **approveStaff()** (4 connections) — `backend/src/services/staff.js`
- **deleteStaff()** (4 connections) — `backend/src/services/staff.js`
- **holdStaff()** (4 connections) — `backend/src/services/staff.js`
- **resumeStaff()** (4 connections) — `backend/src/services/staff.js`
- **revokeStaff()** (4 connections) — `backend/src/services/staff.js`
- **toggleAllStaffPrice()** (4 connections) — `backend/src/services/staff.js`
- **toggleStaffPrice()** (4 connections) — `backend/src/services/staff.js`
- **info.js** (3 connections) — `api/dealer/info.js`
- **optionalAuth()** (3 connections) — `backend/src/middleware/auth.js`
- *... and 30 more nodes in this community*

## Relationships

- [[Master Codebase Architecture Reference]] (42 shared connections)
- [[Product Pages Specification]] (32 shared connections)
- [[Community 47]] (23 shared connections)
- [[Client Products Data Store]] (14 shared connections)
- [[Community 72]] (13 shared connections)
- [[Community 188]] (3 shared connections)
- [[Community 164]] (3 shared connections)
- [[Community 323]] (3 shared connections)

## Source Files

- `api/dealer/info.js`
- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/migrate-content.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/scripts/sync-supabase-content.js`
- `backend/scripts/test-storage.js`
- `backend/src/db/pool.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/loginCode.js`
- `scripts/check_webhooks.mjs`

## Audit Trail

- EXTRACTED: 369 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*