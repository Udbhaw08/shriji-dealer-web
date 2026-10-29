# Live Pricing Audit Tool

> 54 nodes · cohesion 0.10

## Key Concepts

- **auth.js** (55 connections) — `backend/src/routes/auth.js`
- **crmClient.js** (35 connections) — `backend/src/services/crmClient.js`
- **normalizePhone()** (21 connections) — `backend/src/utils/phone.js`
- **normalizeEmail()** (18 connections) — `backend/src/utils/validators.js`
- **notifications.js** (16 connections) — `backend/src/services/notifications.js`
- **env** (15 connections) — `backend/src/config/env.js`
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
- **issueSession()** (7 connections) — `backend/src/routes/auth.js`
- **sendWhatsAppOtp()** (7 connections) — `backend/src/services/notifications.js`
- **isValidEmail()** (7 connections) — `backend/src/utils/validators.js`
- **interconnection.test.mjs** (6 connections) — `backend/test/interconnection.test.mjs`
- **isValidName()** (6 connections) — `backend/src/utils/validators.js`
- **createDealerAccount()** (5 connections) — `backend/src/services/crmClient.js`
- **createDealerContact()** (5 connections) — `backend/src/services/crmClient.js`
- **findOwnerContactInAccount()** (5 connections) — `backend/src/services/crmClient.js`
- **updateContactDetails()** (5 connections) — `backend/src/services/crmClient.js`
- *... and 29 more nodes in this community*

## Relationships

- [[Master Codebase Architecture Reference]] (62 shared connections)
- [[Community 51]] (16 shared connections)
- [[Mobile Responsive UI Skill]] (13 shared connections)
- [[Product Brand & Business Vision]] (10 shared connections)
- [[Community 317]] (4 shared connections)
- [[Community 90]] (1 shared connections)

## Source Files

- `backend/src/config/env.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/rateLimit.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/crmClient.js`
- `backend/src/services/dealerApp.js`
- `backend/src/services/notifications.js`
- `backend/src/utils/phone.js`
- `backend/src/utils/validators.js`
- `backend/test/interconnection.test.mjs`
- `backend/test/validators.test.mjs`

## Audit Trail

- EXTRACTED: 400 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*