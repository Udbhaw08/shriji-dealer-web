# Community 30

> 40 nodes · cohesion 0.13

## Key Concepts

- **sql** (56 connections) — `backend/src/db/pool.js`
- **dealers.js** (36 connections) — `backend/src/routes/dealers.js`
- **dealerApp.js** (24 connections) — `backend/src/services/dealerApp.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (17 connections) — `backend/src/utils/audit.js`
- **webhooks.js** (14 connections) — `backend/src/routes/webhooks.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **auth.js** (8 connections) — `backend/src/middleware/auth.js`
- **generateUniqueDealerCode()** (8 connections) — `backend/src/utils/loginCode.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **applyDealer()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **sha256()** (6 connections) — `backend/src/utils/hash.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
- **applyCrmContactState()** (5 connections) — `backend/src/services/dealerApp.js`
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
- *... and 15 more nodes in this community*

## Relationships

- [[Community 48]] (33 shared connections)
- [[Community 51]] (18 shared connections)
- [[Community 70]] (12 shared connections)
- [[Community 106]] (12 shared connections)
- [[Community 86]] (12 shared connections)
- [[Community 130]] (7 shared connections)
- [[Master Codebase Architecture Reference]] (3 shared connections)

## Source Files

- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/src/db/pool.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/webhooks.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/hash.js`
- `backend/src/utils/loginCode.js`
- `backend/test/crmSync.test.mjs`

## Audit Trail

- EXTRACTED: 299 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*