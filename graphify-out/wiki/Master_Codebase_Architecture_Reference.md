# Master Codebase Architecture Reference

> 62 nodes · cohesion 0.08

## Key Concepts

- **sql** (80 connections) — `backend/src/db/pool.js`
- **dealers.js** (51 connections) — `backend/src/routes/dealers.js`
- **dealerApp.js** (44 connections) — `backend/src/services/dealerApp.js`
- **pool.js** (35 connections) — `backend/src/db/pool.js`
- **staff.js** (23 connections) — `backend/src/services/staff.js`
- **audit()** (18 connections) — `backend/src/utils/audit.js`
- **webhooks.js** (15 connections) — `backend/src/routes/webhooks.js`
- **crmPoll.js** (13 connections) — `backend/src/jobs/crmPoll.js`
- **auth.js** (13 connections) — `backend/src/middleware/auth.js`
- **applyCrmAccountState()** (12 connections) — `backend/src/services/dealerApp.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **verifyDealerRegistrationOtp()** (7 connections) — `backend/src/services/dealerApp.js`
- **audit.js** (7 connections) — `backend/src/utils/audit.js`
- **sync-supabase-content.js** (6 connections) — `backend/scripts/sync-supabase-content.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **createInvite()** (6 connections) — `backend/src/services/staff.js`
- **crmPoll()** (5 connections) — `backend/src/jobs/crmPoll.js`
- **jwtAuth()** (5 connections) — `backend/src/middleware/auth.js`
- **requireAdmin()** (5 connections) — `backend/src/middleware/auth.js`
- **applyCrmContactState()** (5 connections) — `backend/src/services/dealerApp.js`
- **seed-content.js** (4 connections) — `backend/scripts/seed-content.js`
- **deactivateDealer()** (4 connections) — `backend/src/services/dealerApp.js`
- **approveStaff()** (4 connections) — `backend/src/services/staff.js`
- **deleteStaff()** (4 connections) — `backend/src/services/staff.js`
- *... and 37 more nodes in this community*

## Relationships

- [[Client Products Data Store]] (62 shared connections)
- [[Community 49]] (30 shared connections)
- [[Pricing Hierarchy & Zero-Leakage Spec]] (29 shared connections)
- [[Zoho Integration Architecture]] (20 shared connections)
- [[Oxlint Linter Configuration]] (16 shared connections)
- [[Community 91]] (3 shared connections)
- [[Community 322]] (3 shared connections)

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
- `backend/src/jobs/crmPoll.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/routes/webhooks.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/staff.js`
- `backend/src/utils/audit.js`
- `backend/src/utils/loginCode.js`
- `backend/test/crmSync.test.mjs`

## Audit Trail

- EXTRACTED: 467 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*