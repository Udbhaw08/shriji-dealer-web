# Project Readme & Layout

> 44 nodes · cohesion 0.10

## Key Concepts

- **sql** (80 connections) — `backend/src/db/pool.js`
- **dealers.js** (52 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **auth.js** (13 connections) — `backend/src/middleware/auth.js`
- **applyDealer()** (8 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
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
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- **inspect-db.js** (3 connections) — `backend/scripts/inspect-db.js`
- **setup-buckets.js** (3 connections) — `backend/scripts/setup-buckets.js`
- *... and 19 more nodes in this community*

## Relationships

- [[Community 40]] (36 shared connections)
- [[Community 46]] (31 shared connections)
- [[Client Products Data Store]] (21 shared connections)
- [[Pricing Regression Test Suite]] (12 shared connections)
- [[Community 61]] (8 shared connections)
- [[Community 50]] (6 shared connections)
- [[Community 140]] (5 shared connections)
- [[Community 185]] (2 shared connections)
- [[Community 89]] (2 shared connections)

## Source Files

- `api/dealer/info.js`
- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/scripts/sync-supabase-content.js`
- `backend/src/db/pool.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`

## Audit Trail

- EXTRACTED: 304 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*