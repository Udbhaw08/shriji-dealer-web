# Pricing Regression Test Suite

> 56 nodes · cohesion 0.08

## Key Concepts

- **sql** (80 connections) — `backend/src/db/pool.js`
- **dealers.js** (51 connections) — `backend/src/routes/dealers.js`
- **pool.js** (35 connections) — `backend/src/db/pool.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **auth.js** (13 connections) — `backend/src/middleware/auth.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **issueSession()** (7 connections) — `backend/src/routes/auth.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
- **requireAdmin()** (5 connections) — `backend/src/middleware/auth.js`
- **resolveUserWithDealer()** (4 connections) — `backend/src/routes/auth.js`
- **seed-content.js** (4 connections) — `backend/scripts/seed-content.js`
- **deactivateDealer()** (4 connections) — `backend/src/services/dealerApp.js`
- **approveStaff()** (4 connections) — `backend/src/services/staff.js`
- **deleteStaff()** (4 connections) — `backend/src/services/staff.js`
- **holdStaff()** (4 connections) — `backend/src/services/staff.js`
- **resumeStaff()** (4 connections) — `backend/src/services/staff.js`
- **revokeStaff()** (4 connections) — `backend/src/services/staff.js`
- **toggleAllStaffPrice()** (4 connections) — `backend/src/services/staff.js`
- **toggleStaffPrice()** (4 connections) — `backend/src/services/staff.js`
- *... and 31 more nodes in this community*

## Relationships

- [[Community 50]] (39 shared connections)
- [[Product Pages Specification]] (33 shared connections)
- [[Community 45]] (23 shared connections)
- [[Community 43]] (16 shared connections)
- [[Client Products Data Store]] (14 shared connections)
- [[Community 51]] (7 shared connections)
- [[Community 116]] (3 shared connections)

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
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/loginCode.js`

## Audit Trail

- EXTRACTED: 375 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*