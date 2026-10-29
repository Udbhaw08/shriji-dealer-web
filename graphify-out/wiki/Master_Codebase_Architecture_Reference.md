# Master Codebase Architecture Reference

> 63 nodes · cohesion 0.10

## Key Concepts

- **auth.js** (55 connections) — `backend/src/routes/auth.js`
- **dealers.js** (51 connections) — `backend/src/routes/dealers.js`
- **dealerApp.js** (44 connections) — `backend/src/services/dealerApp.js`
- **crmClient.js** (35 connections) — `backend/src/services/crmClient.js`
- **normalizePhone()** (21 connections) — `backend/src/utils/phone.js`
- **normalizeEmail()** (18 connections) — `backend/src/utils/validators.js`
- **notifications.js** (16 connections) — `backend/src/services/notifications.js`
- **validators.js** (15 connections) — `backend/src/utils/validators.js`
- **crmFetch()** (14 connections) — `backend/src/services/crmClient.js`
- **requestDealerRegistrationOtp()** (14 connections) — `backend/src/services/dealerApp.js`
- **finalizeDealerRegistration()** (12 connections) — `backend/src/services/dealerApp.js`
- **isValidPhone()** (11 connections) — `backend/src/utils/validators.js`
- **generateUniqueDealerCode()** (10 connections) — `backend/src/utils/loginCode.js`
- **cleanName()** (9 connections) — `backend/src/utils/validators.js`
- **httpError()** (8 connections) — `backend/src/middleware/errorHandler.js`
- **crmConfigured()** (8 connections) — `backend/src/services/crmClient.js`
- **validators.test.mjs** (8 connections) — `backend/test/validators.test.mjs`
- **phone.js** (8 connections) — `backend/src/utils/phone.js`
- **issueSession()** (7 connections) — `backend/src/routes/auth.js`
- **applyDealer()** (7 connections) — `backend/src/services/dealerApp.js`
- **verifyDealerRegistrationOtp()** (7 connections) — `backend/src/services/dealerApp.js`
- **sendWhatsAppOtp()** (7 connections) — `backend/src/services/notifications.js`
- **isValidEmail()** (7 connections) — `backend/src/utils/validators.js`
- **provisionDealerInCrm()** (6 connections) — `backend/src/services/dealerApp.js`
- **interconnection.test.mjs** (6 connections) — `backend/test/interconnection.test.mjs`
- *... and 38 more nodes in this community*

## Relationships

- [[Pricing & Roles Skill]] (42 shared connections)
- [[Pricing Regression Test Suite]] (24 shared connections)
- [[Architecture Doc Generator]] (23 shared connections)
- [[Community 165]] (20 shared connections)
- [[Community 83]] (9 shared connections)
- [[Community 323]] (4 shared connections)

## Source Files

- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/rateLimit.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/crmClient.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/notifications.js`
- `backend/src/utils/loginCode.js`
- `backend/src/utils/phone.js`
- `backend/src/utils/validators.js`
- `backend/test/interconnection.test.mjs`
- `backend/test/validators.test.mjs`

## Audit Trail

- EXTRACTED: 517 (100%)
- INFERRED: 1 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*