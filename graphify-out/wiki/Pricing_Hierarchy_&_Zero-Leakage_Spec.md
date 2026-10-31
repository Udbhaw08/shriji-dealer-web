# Pricing Hierarchy & Zero-Leakage Spec

> 49 nodes · cohesion 0.13

## Key Concepts

- **dealerApp.js** (45 connections) — `backend/src/services/dealerApp.js`
- **crmClient.js** (39 connections) — `backend/src/services/crmClient.js`
- **normalizePhone()** (21 connections) — `backend/src/utils/phone.js`
- **normalizeEmail()** (18 connections) — `backend/src/utils/validators.js`
- **notifications.js** (16 connections) — `backend/src/services/notifications.js`
- **validators.js** (16 connections) — `backend/src/utils/validators.js`
- **crmFetch()** (15 connections) — `backend/src/services/crmClient.js`
- **requestDealerRegistrationOtp()** (14 connections) — `backend/src/services/dealerApp.js`
- **finalizeDealerRegistration()** (13 connections) — `backend/src/services/dealerApp.js`
- **isValidPhone()** (11 connections) — `backend/src/utils/validators.js`
- **crmConfigured()** (9 connections) — `backend/src/services/crmClient.js`
- **validators.test.mjs** (9 connections) — `backend/test/validators.test.mjs`
- **cleanName()** (9 connections) — `backend/src/utils/validators.js`
- **httpError()** (8 connections) — `backend/src/middleware/errorHandler.js`
- **phone.js** (8 connections) — `backend/src/utils/phone.js`
- **verifyDealerRegistrationOtp()** (7 connections) — `backend/src/services/dealerApp.js`
- **sendWhatsAppOtp()** (7 connections) — `backend/src/services/notifications.js`
- **isValidEmail()** (7 connections) — `backend/src/utils/validators.js`
- **createDealerAccount()** (6 connections) — `backend/src/services/crmClient.js`
- **createDealerContact()** (6 connections) — `backend/src/services/crmClient.js`
- **interconnection.test.mjs** (6 connections) — `backend/test/interconnection.test.mjs`
- **isGstRequiredTreatment()** (6 connections) — `backend/src/utils/validators.js`
- **isValidName()** (6 connections) — `backend/src/utils/validators.js`
- **findOwnerContactInAccount()** (5 connections) — `backend/src/services/crmClient.js`
- **normalizeUserSource()** (5 connections) — `backend/src/services/crmClient.js`
- *... and 24 more nodes in this community*

## Relationships

- [[Live Pricing Audit Tool]] (34 shared connections)
- [[Design System & UI Tokens]] (28 shared connections)
- [[Community 51]] (17 shared connections)
- [[Product Requirements Documentation]] (4 shared connections)
- [[Community 325]] (4 shared connections)
- [[Community 140]] (2 shared connections)

## Source Files

- `backend/src/middleware/errorHandler.js`
- `backend/src/routes/auth.js`
- `backend/src/services/crmClient.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/notifications.js`
- `backend/src/utils/phone.js`
- `backend/src/utils/validators.js`
- `backend/test/interconnection.test.mjs`
- `backend/test/validators.test.mjs`

## Audit Trail

- EXTRACTED: 385 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*