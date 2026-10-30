# Master Codebase Architecture Reference

> 60 nodes · cohesion 0.10

## Key Concepts

- **auth.js** (55 connections) — `backend/src/routes/auth.js`
- **dealerApp.js** (44 connections) — `backend/src/services/dealerApp.js`
- **crmClient.js** (39 connections) — `backend/src/services/crmClient.js`
- **normalizePhone()** (21 connections) — `backend/src/utils/phone.js`
- **normalizeEmail()** (18 connections) — `backend/src/utils/validators.js`
- **notifications.js** (16 connections) — `backend/src/services/notifications.js`
- **crmFetch()** (15 connections) — `backend/src/services/crmClient.js`
- **validators.js** (15 connections) — `backend/src/utils/validators.js`
- **requestDealerRegistrationOtp()** (14 connections) — `backend/src/services/dealerApp.js`
- **finalizeDealerRegistration()** (12 connections) — `backend/src/services/dealerApp.js`
- **isValidPhone()** (11 connections) — `backend/src/utils/validators.js`
- **crmConfigured()** (9 connections) — `backend/src/services/crmClient.js`
- **cleanName()** (9 connections) — `backend/src/utils/validators.js`
- **httpError()** (8 connections) — `backend/src/middleware/errorHandler.js`
- **issueSession()** (8 connections) — `backend/src/routes/auth.js`
- **validators.test.mjs** (8 connections) — `backend/test/validators.test.mjs`
- **phone.js** (8 connections) — `backend/src/utils/phone.js`
- **verifyDealerRegistrationOtp()** (7 connections) — `backend/src/services/dealerApp.js`
- **sendWhatsAppOtp()** (7 connections) — `backend/src/services/notifications.js`
- **isValidEmail()** (7 connections) — `backend/src/utils/validators.js`
- **createDealerAccount()** (6 connections) — `backend/src/services/crmClient.js`
- **createDealerContact()** (6 connections) — `backend/src/services/crmClient.js`
- **interconnection.test.mjs** (6 connections) — `backend/test/interconnection.test.mjs`
- **isValidName()** (6 connections) — `backend/src/utils/validators.js`
- **findOwnerContactInAccount()** (5 connections) — `backend/src/services/crmClient.js`
- *... and 35 more nodes in this community*

## Relationships

- [[Live Pricing Audit Tool]] (42 shared connections)
- [[Community 47]] (23 shared connections)
- [[Product Pages Specification]] (17 shared connections)
- [[Client Products Data Store]] (16 shared connections)
- [[Community 323]] (4 shared connections)

## Source Files

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

- EXTRACTED: 462 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*