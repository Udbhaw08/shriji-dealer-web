# Community 61

> 23 nodes · cohesion 0.24

## Key Concepts

- **sql** (41 connections) — `backend/src/db/pool.js`
- **dealers.js** (30 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (17 connections) — `backend/src/utils/audit.js`
- **auth.js** (8 connections) — `backend/src/middleware/auth.js`
- **generateUniqueDealerCode()** (8 connections) — `backend/src/utils/loginCode.js`
- **applyDealer()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
- **deactivateDealer()** (4 connections) — `backend/src/services/dealerApp.js`
- **approveStaff()** (4 connections) — `backend/src/services/staff.js`
- **deleteStaff()** (4 connections) — `backend/src/services/staff.js`
- **holdStaff()** (4 connections) — `backend/src/services/staff.js`
- **resumeStaff()** (4 connections) — `backend/src/services/staff.js`
- **revokeStaff()** (4 connections) — `backend/src/services/staff.js`
- **toggleAllStaffPrice()** (4 connections) — `backend/src/services/staff.js`
- **toggleStaffPrice()** (4 connections) — `backend/src/services/staff.js`
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- **consumeInvite()** (3 connections) — `backend/src/services/staff.js`
- **generateInviteCode()** (3 connections) — `backend/src/services/staff.js`
- **check()** (2 connections) — `backend/scripts/check-readiness.js`
- **requireRole()** (1 connections) — `backend/src/middleware/auth.js`
- **check-readiness.js** (1 connections) — `backend/scripts/check-readiness.js`

## Relationships

- [[Community 68]] (27 shared connections)
- [[Community 73]] (12 shared connections)
- [[Community 93]] (9 shared connections)
- [[Community 63]] (9 shared connections)
- [[Community 90]] (6 shared connections)
- [[Community 115]] (4 shared connections)

## Source Files

- `backend/scripts/check-readiness.js`
- `backend/src/db/pool.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/loginCode.js`

## Audit Trail

- EXTRACTED: 185 (98%)
- INFERRED: 4 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*