# Oxlint Linter Configuration

> 45 nodes · cohesion 0.09

## Key Concepts

- **sql** (76 connections) — `backend/src/db/pool.js`
- **dealers.js** (46 connections) — `backend/src/routes/dealers.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **auth.js** (12 connections) — `backend/src/middleware/auth.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
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
- **requireApprovedDealer()** (3 connections) — `backend/src/middleware/auth.js`
- **inspect-db.js** (3 connections) — `backend/scripts/inspect-db.js`
- *... and 20 more nodes in this community*

## Relationships

- [[Community 37]] (33 shared connections)
- [[Community 59]] (27 shared connections)
- [[Community 43]] (14 shared connections)
- [[Zoho Integration Architecture]] (14 shared connections)
- [[Community 89]] (11 shared connections)
- [[Community 74]] (10 shared connections)
- [[Community 113]] (4 shared connections)
- [[Community 146]] (3 shared connections)
- [[Community 189]] (2 shared connections)
- [[Community 98]] (1 shared connections)

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

- EXTRACTED: 303 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*