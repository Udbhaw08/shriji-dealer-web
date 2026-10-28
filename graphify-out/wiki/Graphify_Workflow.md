# Graphify Workflow

> 42 nodes · cohesion 0.10

## Key Concepts

- **sql** (78 connections) — `backend/src/db/pool.js`
- **dealers.js** (49 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
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
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- **inspect-db.js** (3 connections) — `backend/scripts/inspect-db.js`
- **setup-buckets.js** (3 connections) — `backend/scripts/setup-buckets.js`
- **setup-policies.js** (3 connections) — `backend/scripts/setup-policies.js`
- *... and 17 more nodes in this community*

## Relationships

- [[Product Requirements Documentation]] (39 shared connections)
- [[Community 50]] (30 shared connections)
- [[Zoho Integration Skill]] (17 shared connections)
- [[Pricing Regression Test Suite]] (14 shared connections)
- [[Community 89]] (9 shared connections)
- [[Community 138]] (6 shared connections)
- [[Community 145]] (4 shared connections)
- [[Community 187]] (2 shared connections)
- [[Community 321]] (2 shared connections)

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
- `backend/src/utils/loginCode.js`

## Audit Trail

- EXTRACTED: 297 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*