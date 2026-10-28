# Vercel Deployment Routing

> 42 nodes · cohesion 0.11

## Key Concepts

- **sql** (79 connections) — `backend/src/db/pool.js`
- **dealers.js** (50 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **auth.js** (13 connections) — `backend/src/middleware/auth.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
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
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- *... and 17 more nodes in this community*

## Relationships

- [[Client Products Data Store]] (41 shared connections)
- [[Pricing Regression Test Suite]] (25 shared connections)
- [[Community 72]] (24 shared connections)
- [[Community 88]] (11 shared connections)
- [[Community 51]] (7 shared connections)
- [[Community 115]] (6 shared connections)
- [[Community 138]] (6 shared connections)
- [[Community 94]] (3 shared connections)
- [[Community 189]] (2 shared connections)
- [[Community 399]] (2 shared connections)
- [[Community 89]] (1 shared connections)
- [[Community 182]] (1 shared connections)

## Source Files

- `api/dealer/info.js`
- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/src/db/pool.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/loginCode.js`

## Audit Trail

- EXTRACTED: 315 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*