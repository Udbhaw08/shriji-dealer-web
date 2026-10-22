# Project Readme & Layout

> 37 nodes · cohesion 0.13

## Key Concepts

- **sql** (59 connections) — `backend/src/db/pool.js`
- **dealers.js** (36 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (17 connections) — `backend/src/utils/audit.js`
- **auth.js** (8 connections) — `backend/src/middleware/auth.js`
- **generateUniqueDealerCode()** (8 connections) — `backend/src/utils/loginCode.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **prices.js** (6 connections) — `backend/src/routes/prices.js`
- **applyDealer()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **sha256()** (6 connections) — `backend/src/utils/hash.js`
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
- **setup-buckets.js** (3 connections) — `backend/scripts/setup-buckets.js`
- **setup-policies.js** (3 connections) — `backend/scripts/setup-policies.js`
- *... and 12 more nodes in this community*

## Relationships

- [[Community 43]] (27 shared connections)
- [[Community 46]] (20 shared connections)
- [[Community 71]] (11 shared connections)
- [[Community 36]] (10 shared connections)
- [[Community 64]] (9 shared connections)
- [[Dealer Auth & Session Management]] (7 shared connections)
- [[Community 90]] (5 shared connections)

## Source Files

- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/src/db/pool.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/prices.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/hash.js`
- `backend/src/utils/loginCode.js`

## Audit Trail

- EXTRACTED: 253 (98%)
- INFERRED: 4 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*