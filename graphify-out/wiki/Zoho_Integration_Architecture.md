# Zoho Integration Architecture

> 56 nodes · cohesion 0.06

## Key Concepts

- **auth.js** (54 connections) — `backend/src/routes/auth.js`
- **hash.js** (25 connections) — `backend/src/utils/hash.js`
- **phase2DealerStaffOnboarding.test.mjs** (17 connections) — `backend/test/phase2DealerStaffOnboarding.test.mjs`
- **loginCode.js** (17 connections) — `backend/src/utils/loginCode.js`
- **onboardingVerification.test.mjs** (15 connections) — `backend/test/onboardingVerification.test.mjs`
- **hashOtp()** (10 connections) — `backend/src/utils/hash.js`
- **verifyOtpHash()** (10 connections) — `backend/src/utils/hash.js`
- **hash.test.mjs** (9 connections) — `backend/test/hash.test.mjs`
- **sha256()** (9 connections) — `backend/src/utils/hash.js`
- **formatLoginCode()** (8 connections) — `backend/src/utils/loginCode.js`
- **generateLoginCode()** (8 connections) — `backend/src/utils/loginCode.js`
- **loginCode.test.mjs** (7 connections) — `backend/test/loginCode.test.mjs`
- **issueSession()** (5 connections) — `backend/src/routes/auth.js`
- **generateOtp()** (5 connections) — `backend/src/utils/hash.js`
- **hashPassword()** (5 connections) — `backend/src/utils/hash.js`
- **resolveUserWithDealer()** (4 connections) — `backend/src/routes/auth.js`
- **verifyPassword()** (4 connections) — `backend/src/utils/hash.js`
- **isValidLoginCode()** (4 connections) — `backend/src/utils/loginCode.js`
- **parseLoginCode()** (4 connections) — `backend/src/utils/loginCode.js`
- **findUserByEmail()** (3 connections) — `backend/src/routes/auth.js`
- **publicUser()** (3 connections) — `backend/src/routes/auth.js`
- **handleDealerRegistrationFinalize()** (3 connections) — `backend/src/routes/dealers.js`
- **notify()** (3 connections) — `backend/src/services/notifications.js`
- **scryptKey()** (3 connections) — `backend/src/utils/hash.js`
- **USER_CATEGORIES** (3 connections) — `backend/src/utils/loginCode.js`
- *... and 31 more nodes in this community*

## Relationships

- [[Graphify Agent Rules]] (25 shared connections)
- [[Community 70]] (25 shared connections)
- [[Product Brand & Business Vision]] (7 shared connections)
- [[Community 116]] (6 shared connections)
- [[Community 51]] (5 shared connections)
- [[Community 181]] (4 shared connections)
- [[Community 138]] (2 shared connections)

## Source Files

- `backend/src/routes/auth.js`
- `backend/src/routes/dealers.js`
- `backend/src/services/notifications.js`
- `backend/src/utils/hash.js`
- `backend/src/utils/loginCode.js`
- `backend/test/hash.test.mjs`
- `backend/test/loginCode.test.mjs`
- `backend/test/onboardingVerification.test.mjs`
- `backend/test/phase2DealerStaffOnboarding.test.mjs`

## Audit Trail

- EXTRACTED: 274 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*