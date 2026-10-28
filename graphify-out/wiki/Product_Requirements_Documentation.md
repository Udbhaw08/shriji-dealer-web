# Product Requirements Documentation

> 56 nodes · cohesion 0.11

## Key Concepts

- **auth.js** (54 connections) — `backend/src/routes/auth.js`
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
- **cleanName()** (9 connections) — `backend/src/utils/validators.js`
- **httpError()** (8 connections) — `backend/src/middleware/errorHandler.js`
- **crmConfigured()** (8 connections) — `backend/src/services/crmClient.js`
- **validators.test.mjs** (8 connections) — `backend/test/validators.test.mjs`
- **phone.js** (8 connections) — `backend/src/utils/phone.js`
- **verifyDealerRegistrationOtp()** (7 connections) — `backend/src/services/dealerApp.js`
- **sendWhatsAppOtp()** (7 connections) — `backend/src/services/notifications.js`
- **isValidEmail()** (7 connections) — `backend/src/utils/validators.js`
- **interconnection.test.mjs** (6 connections) — `backend/test/interconnection.test.mjs`
- **isValidName()** (6 connections) — `backend/src/utils/validators.js`
- **issueSession()** (5 connections) — `backend/src/routes/auth.js`
- **createDealerAccount()** (5 connections) — `backend/src/services/crmClient.js`
- **createDealerContact()** (5 connections) — `backend/src/services/crmClient.js`
- **findOwnerContactInAccount()** (5 connections) — `backend/src/services/crmClient.js`
- *... and 31 more nodes in this community*

## Relationships

- [[Graphify Workflow]] (39 shared connections)
- [[Community 50]] (22 shared connections)
- [[Pricing Regression Test Suite]] (16 shared connections)
- [[Zoho Integration Skill]] (12 shared connections)
- [[Community 138]] (4 shared connections)
- [[Community 321]] (4 shared connections)

## Source Files

- `backend/src/middleware/errorHandler.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/crmClient.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/notifications.js`
- `backend/src/utils/phone.js`
- `backend/src/utils/validators.js`
- `backend/test/crmSync.test.mjs`
- `backend/test/interconnection.test.mjs`
- `backend/test/validators.test.mjs`

## Audit Trail

- EXTRACTED: 437 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*