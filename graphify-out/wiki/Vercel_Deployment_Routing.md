# Vercel Deployment Routing

> 41 nodes · cohesion 0.11

## Key Concepts

- **sql** (67 connections) — `backend/src/db/pool.js`
- **dealers.js** (36 connections) — `backend/src/routes/dealers.js`
- **dealerApp.js** (24 connections) — `backend/src/services/dealerApp.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (17 connections) — `backend/src/utils/audit.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **applyDealer()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **sha256()** (6 connections) — `backend/src/utils/hash.js`
- **upload.js** (5 connections) — `api/upload.js`
- **crmPoll()** (5 connections) — `backend/src/jobs/crmPoll.js`
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
- **markPollRun()** (3 connections) — `backend/src/jobs/crmPoll.js`
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- **inspect-db.js** (3 connections) — `backend/scripts/inspect-db.js`
- *... and 16 more nodes in this community*

## Relationships

- [[Community 54]] (34 shared connections)
- [[Community 35]] (26 shared connections)
- [[Community 43]] (15 shared connections)
- [[Community 83]] (14 shared connections)
- [[Price Presentation & Product UI]] (9 shared connections)
- [[Community 130]] (7 shared connections)
- [[Community 376]] (2 shared connections)

## Source Files

- `api/upload.js`
- `backend/scripts/check-readiness.js`
- `backend/scripts/inspect-db.js`
- `backend/scripts/seed-content.js`
- `backend/scripts/setup-buckets.js`
- `backend/scripts/setup-policies.js`
- `backend/src/db/pool.js`
- `backend/src/jobs/crmPoll.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/hash.js`
- `backend/test/crmSync.test.mjs`

## Audit Trail

- EXTRACTED: 292 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*