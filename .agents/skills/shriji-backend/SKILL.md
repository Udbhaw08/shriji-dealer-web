---
name: shriji-backend
description: >-
  Use this skill when working on the backend/ Node service — auth, JWT, OTP,
  dealer applications, Zoho CRM sync, approval webhooks, staff invites, price
  proxy, catalog cache, migrations, or the Supabase database. Records the exact
  stack so implementations do not drift.
---

# Shriji Backend Skill

Runbook for the dedicated backend service in `backend/`. Master spec:
`docs/BACKEND-ARCHITECTURE.md`. Zoho Commerce proxy (`api/`) is governed by
[[shriji-zoho-integration]], pricing rules by [[shriji-pricing-and-roles]].

## Stack Record — what was chosen, do not substitute

| Concern | Choice | Do NOT swap for |
|---|---|---|
| Runtime | Node.js 20, Express | Vercel serverless (needs cron + warm cache), NestJS |
| Database | **Supabase Postgres** via `postgres.js` pool | Firebase (NoSQL mismatch), Prisma, Supabase Auth || Password hashing | node:crypto scrypt (N=16384, r=8, p=1, per-user salt) | bcrypt, plain sha256, argon2 (native build risk) |
| Tokens | JWT access tokens (`jsonwebtoken`, claims: `role`, `dealer_id`) + rotating hashed refresh tokens in DB | localStorage JWT, Supabase-managed sessions |
| Cron | In-process jobs: `crmPoll` (5 min), `catalogSync`, `tokenCleanup` | External schedulers |
| Deploy | Railway (India region), Render fallback | — |

**Supabase is used ONLY as a Postgres database.** No Supabase Auth, no RLS-based app
authz — the backend owns all credentials, tokens and access decisions.

## Ownership Rule (invariant)

- **Zoho CRM** owns the dealer record (Account + Contacts) and the approval decision.
- **Zoho Commerce** owns products, price lists, orders.
- **Backend** owns logins, roles, staff access, security.
- **App** only displays what the backend returns.

## Hard Rules

1. **Webhook dedup mandatory** — every CRM webhook insert-checks `webhook_events`
   (`source` + `payload_hash`) before acting; replays are ignored once processed.
2. **CRM is source of truth for approval** — on webhook (and in the 5-min fallback poll),
   re-fetch the Account from CRM; never trust webhook payload fields for status.
3. **Secrets never enter the client bundle** — refresh tokens, OTPs, invite codes,
   scrypt hashes stay server-side. Invite/OTP codes are stored as hashes only.
4. **Price proxy gates by role** — dealer rates only for `role=dealer|dealer_staff` with
   `status=active` and an `approved` dealer. Customers/revoked dealers get MRP only.
   Zero price → `price_on_request`, never ₹0.
5. **Catalog cache is a copy** — Zoho stays master; the cache is refreshed on schedule
   and never hand-edited.
6. **Audit every mutating action** to `audit_log` (actor, action, target, meta jsonb).

## Key Files (populated as built)

```
backend/src/config/        env + constants
backend/src/db/            migrations/ (SQL), pool.js, migrate.js
backend/src/routes/        auth (login/signup/OTP/staff/me), dealers (apply, staff mgmt),
                           prices (role-gated proxy), webhooks (CRM approval), health
backend/src/services/      tokens (JWT + refresh rotation), dealerApp, crmClient,
                           commerceClient, catalog (priceView role gate), staff, notifications
backend/src/middleware/    auth (jwtAuth/requireApprovedDealer), rateLimit, errorHandler
backend/src/jobs/          crmPoll (5-min), catalogSync, tokenCleanup
backend/test/              hash, tokens, priceGate (unit) + integration (needs TEST_DATABASE_URL)
```

## Frontend Integration (built)

- `src/data/auth.js` — the only module that talks to the backend. Access token in
  memory, refresh token in Capacitor Preferences (native) / sessionStorage (web).
  `callBackend()` auto-refreshes once on 401. Base URL: `VITE_AUTH_API_URL`
  (dev default `http://localhost:8080`).
- `src/data/session.js` — mirrors `/api/auth/me`; maps backend roles onto the
  viewer model (`dealer`+`dealer_staff` → role `dealer`, status from CRM dealer row).
- `src/pages/Login.jsx` — sign in (password or OTP), signup + dealer application,
  staff invite redemption, pending-approval screen polling every 8s.
- `src/pages/DealerDashboard.jsx` (`/dealer`) — invite code generation, staff
  approve/revoke.
- Backend CORS: `FRONTEND_ORIGINS` env (comma-separated, default localhost:5173).

## Pending Seam — price proxy switch (do when backend is deployed)

`src/data/productsStore.jsx` still fetches `/api/products` (Vercel Zoho proxy), which
ships `dealerRate` to every client — masking is still client-side in `priceFor()`.
Once the backend is live with a synced catalog, switch price reads to
`GET /api/prices` (auth.js already has the base) and delete `dealerRate` from the
Vercel proxy payload. The `?from=` share-link customer-view logic must keep working
unchanged (docs/ROLES-AND-SHARING.md).

## Environment (backend/.env — never committed)

```
DATABASE_URL=            # Supabase pooled connection string
JWT_SECRET=
ZOHO_DC=in
ZOHO_CRM_CLIENT_ID=      # CRM Self Client — separate from the Commerce client
ZOHO_CRM_CLIENT_SECRET=
ZOHO_CRM_REFRESH_TOKEN=
ZOHO_CRM_ORG_ID=
```

CRM scope: `ZohoCRM.modules.ALL`, token exchange at `accounts.zoho.in`
(same DC rules as the Commerce integration).

## Commands

```bash
cd backend
npm test            # unit + integration (node --test)
npm run migrate     # apply migrations in db/migrations/
npm start           # long-running service (Railway/Render)
```
