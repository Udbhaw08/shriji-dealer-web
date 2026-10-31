# Live Pricing Audit Tool

> 52 nodes · cohesion 0.08

## Key Concepts

- **sql** (80 connections) — `backend/src/db/pool.js`
- **dealers.js** (52 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **auth.js** (13 connections) — `backend/src/middleware/auth.js`
- **applyCrmAccountState()** (13 connections) — `backend/src/services/dealerApp.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **issueSession()** (8 connections) — `backend/src/routes/auth.js`
- **applyDealer()** (8 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **crmPoll()** (5 connections) — `backend/src/jobs/crmPoll.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
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
- *... and 27 more nodes in this community*

## Relationships

- [[Pricing Hierarchy & Zero-Leakage Spec]] (34 shared connections)
- [[Community 51]] (31 shared connections)
- [[Design System & UI Tokens]] (26 shared connections)
- [[Product Requirements Documentation]] (21 shared connections)
- [[Community 56]] (8 shared connections)
- [[Community 140]] (7 shared connections)
- [[Community 189]] (2 shared connections)
- [[Community 89]] (2 shared connections)
- [[Community 325]] (2 shared connections)

## Source Files

- `api/dealer/info.js`
- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/scripts/sync-supabase-content.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/crmPoll.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/loginCode.js`
- `backend/test/crmSync.test.mjs`

## Audit Trail

- EXTRACTED: 351 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*