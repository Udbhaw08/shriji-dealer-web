# Architecture Doc Generator

> 52 nodes · cohesion 0.10

## Key Concepts

- **session.js** (54 connections) — `src/data/session.js`
- **Login.jsx** (45 connections) — `src/pages/Login.jsx`
- **DealerApply.jsx** (26 connections) — `src/pages/DealerApply.jsx`
- **BrandApplyFlow.jsx** (23 connections) — `src/components/BrandApplyFlow.jsx`
- **StaffDashboard.jsx** (16 connections) — `src/pages/StaffDashboard.jsx`
- **revalidateSession()** (14 connections) — `src/data/session.js`
- **StaffJoin.jsx** (14 connections) — `src/pages/StaffJoin.jsx`
- **EmailVerificationPrompt.jsx** (12 connections) — `src/components/EmailVerificationPrompt.jsx`
- **PhoneVerificationPrompt.jsx** (12 connections) — `src/components/PhoneVerificationPrompt.jsx`
- **validators.js** (12 connections) — `src/data/validators.js`
- **loginCode.js** (11 connections) — `src/data/loginCode.js`
- **setSession()** (11 connections) — `src/data/session.js`
- **hasSession()** (8 connections) — `src/data/auth.js`
- **signOut()** (8 connections) — `src/data/session.js`
- **registerDealer()** (7 connections) — `src/data/dealer.js`
- **isValidEmail()** (7 connections) — `src/data/validators.js`
- **applyAsDealer()** (6 connections) — `src/data/auth.js`
- **requestEmailOtp()** (6 connections) — `src/data/auth.js`
- **formatLoginCode()** (6 connections) — `src/data/loginCode.js`
- **isValidName()** (6 connections) — `src/data/validators.js`
- **isValidPhone()** (6 connections) — `src/data/validators.js`
- **DealerPending.jsx** (6 connections) — `src/pages/DealerPending.jsx`
- **OtpDispatchFeedback.jsx** (5 connections) — `src/components/OtpDispatchFeedback.jsx`
- **OtpDispatchFeedback()** (5 connections) — `src/components/OtpDispatchFeedback.jsx`
- **switchToDealerSession()** (5 connections) — `src/data/session.js`
- *... and 27 more nodes in this community*

## Relationships

- [[Community 35]] (56 shared connections)
- [[Product Pages Specification]] (53 shared connections)
- [[Community 93]] (12 shared connections)
- [[Community 48]] (8 shared connections)
- [[Community 170]] (1 shared connections)
- [[Community 154]] (1 shared connections)

## Source Files

- `src/components/BrandApplyFlow.jsx`
- `src/components/EmailVerificationPrompt.jsx`
- `src/components/OtpDispatchFeedback.jsx`
- `src/components/PhoneVerificationPrompt.jsx`
- `src/data/auth.js`
- `src/data/dealer.js`
- `src/data/loginCode.js`
- `src/data/session.js`
- `src/data/validators.js`
- `src/pages/DealerApply.jsx`
- `src/pages/DealerDashboard.jsx`
- `src/pages/DealerPending.jsx`
- `src/pages/Login.jsx`
- `src/pages/StaffDashboard.jsx`
- `src/pages/StaffJoin.jsx`

## Audit Trail

- EXTRACTED: 395 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*