# Zoho Integration Architecture

> 56 nodes · cohesion 0.10

## Key Concepts

- **auth.js** (40 connections) — `src/data/auth.js`
- **Login.jsx** (40 connections) — `src/pages/Login.jsx`
- **callBackend()** (24 connections) — `src/data/auth.js`
- **json()** (24 connections) — `src/data/auth.js`
- **DealerDashboard.jsx** (23 connections) — `src/pages/DealerDashboard.jsx`
- **apiFetch()** (16 connections) — `src/data/api.js`
- **api.js** (11 connections) — `src/data/api.js`
- **EmailVerificationPrompt.jsx** (10 connections) — `src/components/EmailVerificationPrompt.jsx`
- **broadcastAuthChange()** (10 connections) — `src/data/auth.js`
- **apiUrl()** (9 connections) — `src/data/api.js`
- **revalidateSession()** (9 connections) — `src/data/session.js`
- **loginCode.js** (8 connections) — `src/data/loginCode.js`
- **validators.js** (7 connections) — `src/data/validators.js`
- **applyAuthResponse()** (6 connections) — `src/data/auth.js`
- **logout()** (6 connections) — `src/data/auth.js`
- **fetchMe()** (5 connections) — `src/data/auth.js`
- **googleLogin()** (5 connections) — `src/data/auth.js`
- **login()** (5 connections) — `src/data/auth.js`
- **signup()** (5 connections) — `src/data/auth.js`
- **staffTogglePrice()** (5 connections) — `src/data/auth.js`
- **staffTogglePriceAll()** (5 connections) — `src/data/auth.js`
- **verifyEmailOtp()** (5 connections) — `src/data/auth.js`
- **applyAsDealer()** (4 connections) — `src/data/auth.js`
- **hasSession()** (4 connections) — `src/data/auth.js`
- **lookupStaffCode()** (4 connections) — `src/data/auth.js`
- *... and 31 more nodes in this community*

## Relationships

- [[Community 79]] (26 shared connections)
- [[Pricing Regression Test Suite]] (25 shared connections)
- [[Community 34]] (7 shared connections)
- [[Community 60]] (3 shared connections)
- [[Community 168]] (1 shared connections)

## Source Files

- `src/components/EmailVerificationPrompt.jsx`
- `src/data/api.js`
- `src/data/auth.js`
- `src/data/loginCode.js`
- `src/data/session.js`
- `src/data/validators.js`
- `src/pages/DealerDashboard.jsx`
- `src/pages/Login.jsx`

## Audit Trail

- EXTRACTED: 382 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*