# Pricing Regression Test Suite

> 51 nodes · cohesion 0.09

## Key Concepts

- **sql** (67 connections) — `backend/src/db/pool.js`
- **dealers.js** (36 connections) — `backend/src/routes/dealers.js`
- **pool.js** (30 connections) — `backend/src/db/pool.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (17 connections) — `backend/src/utils/audit.js`
- **auth.js** (8 connections) — `backend/src/middleware/auth.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **prices.js** (6 connections) — `backend/src/routes/prices.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **applyDealer()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **sha256()** (6 connections) — `backend/src/utils/hash.js`
- **upload.js** (5 connections) — `api/upload.js`
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
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- **inspect-db.js** (3 connections) — `backend/scripts/inspect-db.js`
- *... and 26 more nodes in this community*

## Relationships

- [[Community 52]] (32 shared connections)
- [[Community 48]] (17 shared connections)
- [[Community 59]] (16 shared connections)
- [[Dealer Auth & Session Management]] (11 shared connections)
- [[Community 82]] (11 shared connections)
- [[Community 114]] (5 shared connections)
- [[Community 138]] (4 shared connections)

## Source Files

- `api/upload.js`
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
- `backend/src/routes/prices.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/hash.js`

## Audit Trail

- EXTRACTED: 313 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*