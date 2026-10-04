# BACKEND-ARCHITECTURE.md — Dedicated Node Backend, Supabase Postgres & Zoho Ownership Model

The dealer portal needs real authentication, roles, staff management and a price proxy.
**Status: Design approved & being implemented (2026-10-05). Phase 0 docs.**

This is the master spec for the new `backend/` service. Read this before writing any
backend code or touching auth/pricing flows. Zoho Commerce details stay in
[ZOHO-INTEGRATION.md](ZOHO-INTEGRATION.md); pricing rules stay in
[PRICING-ARCHITECTURE.md](PRICING-ARCHITECTURE.md); viewer/role rules stay in
[ROLES-AND-SHARING.md](ROLES-AND-SHARING.md).

---

## 0. The Ownership Rule — one sentence per system

| System | Owns | Never owns |
|---|---|---|
| **Zoho CRM** | The dealer record (Account + Contacts) and the **approval decision** (Dealer Status) | Passwords, logins, sessions |
| **Zoho Commerce** | Products, price lists, orders | User identity, roles |
| **Our backend** (`backend/`) | Logins, roles, staff access, security, tokens | The approval decision (it obeys CRM) |
| **The app** (web + Capacitor) | Display only | Any price computation or trust decision |

**Invariant:** the app only ever displays what the backend returns. The backend only ever
trusts Zoho CRM for the approval decision, and only ever returns dealer rates to
authenticated, approved dealers.

## 1. What is done in Zoho (setup checklist)

### 1.1 CRM — dealers and staff

- Dealers are **Accounts**; the owner and each staff member are **Contacts** under that Account.
- Custom fields to add on **Accounts**: `GST Number` (text), `Dealer Status` (picklist:
  `Pending`, `Approved`, `Rejected`, `Revoked`), `Dealer Code` (text, unique), `Price Tier` (picklist).
- Custom fields to add on **Contacts**: `Portal Role` (picklist: `Owner`, `Staff`),
  `Backend User ID` (text — the backend writes its `users.id` here so the two systems link).
- **Approval:** the owner reviews the application in CRM and flips `Dealer Status`. A CRM
  **workflow rule** on that field change fires a webhook to the backend
  (`POST /webhooks/crm/approval`).

### 1.2 CRM — API access

- Create a **Self Client** at <https://api-console.zoho.com> (same flow as §3.2 of
  [ZOHO-INTEGRATION.md](ZOHO-INTEGRATION.md)) and grant the scope:

  ```
  ZohoCRM.modules.ALL
  ```

- Exchange the grant code for a **refresh token** and store it **only in backend env**
  (`ZOHO_CRM_REFRESH_TOKEN`). The OAuth data centre rule from §3.5 of
  [ZOHO-INTEGRATION.md](ZOHO-INTEGRATION.md) applies unchanged (`accounts.zoho.in` for India).

### 1.3 Commerce

- Left as-is: products, retail/dealer price lists and orders stay where they are
  (see [ZOHO-INTEGRATION.md](ZOHO-INTEGRATION.md)).
- Optional later: a sales-order webhook into the backend for order events.

## 2. Backend responsibilities

1. **Identity** — signup, login, OTP, JWT access tokens (claims: `role`, `dealer_id`) and
   rotating refresh tokens. Passwords are hashed with **node:crypto scrypt**
   (N=16384, r=8, p=1, per-user salt, timing-safe compare — no native deps).
2. **Dealer applications** — persist the application as `pending`, then create the Account
   and Contact in CRM via the CRM REST API.
3. **Approval intake** — receive the CRM webhook, **re-fetch the Account from CRM as the
   source of truth**, update its own `dealers` row, notify the dealer. A **5-minute fallback
   poll** catches any webhook miss.
4. **Staff access** — invite codes, staff signup as `pending`, dealer approval, revocation.
5. **Price proxy** — returns MRP-only or dealer-tier prices **by role**, served from an
   in-memory catalog cache refreshed from Zoho on a schedule. This closes today's leak where
   `dealerRate` ships to every client (see [PRICING-ARCHITECTURE.md](PRICING-ARCHITECTURE.md)).
6. **Security plumbing** — rate limits on every auth and mutating route, audit log,
   notifications (email first, WhatsApp later).

## 3. Integration flows

1. **Dealer applies:** App → backend → save as `pending` → create Account + Contact in CRM.
2. **Approval:** Owner flips Dealer Status in CRM → webhook fires → backend re-fetches the
   Account → updates `dealers` row + promotes owner user to `active` → notifies dealer.
   Fallback poll every 5 min guarantees convergence even if the webhook is lost.
3. **Staff:** dealer generates an invite code → staff signs up with it (status `pending`)
   → dealer approves in dashboard → backend activates the user and creates their Contact in CRM.
   Revocation deactivates the user and revokes their tokens.
4. **Prices:** App sends its JWT → backend checks role/status → returns dealer or retail
   prices from the cache. A customer (or revoked dealer) can never receive a dealer rate.
5. **Catalog sync:** backend refreshes products and price lists from Zoho Commerce on a
   schedule into the cache; Zoho remains master, the cache is only a copy.

## 4. Data movement

| Direction | Data |
|---|---|
| Zoho CRM → backend | Dealer status, dealer code, price tier (Accounts); contact IDs |
| Zoho Commerce → backend | Product and price-list data (scheduled sync); optional order events |
| Backend → Zoho CRM | New dealer's name, phone, email, GST, address; staff Contacts after approval |
| **Never leaves the backend** | Passwords (scrypt hashes), access/refresh tokens, OTPs, invite codes |

## 5. Storage — what the backend keeps

Users and credentials; a local copy of the dealer record with its Zoho IDs; staff invites;
hashed refresh tokens; audit log; processed-webhook IDs (idempotency); sync timestamps; a
catalog cache. **The cache is only a copy — Zoho stays the master.**

### 5.1 Schema (Supabase Postgres)

```sql
users(id uuid pk default gen_random_uuid(), email text unique not null,
  phone text, password_hash text,
  role text not null default 'customer',   -- customer | dealer | dealer_staff
  status text not null default 'pending',  -- pending | active | rejected | revoked
  dealer_id uuid references dealers(id), email_verified bool default false,
  zoho_contact_id text, created_at timestamptz default now())

dealers(id uuid pk default gen_random_uuid(), owner_user_id uuid references users(id),
  business_name text not null, gst_number text, address text,
  status text not null default 'pending',  -- pending | approved | rejected | revoked
  reject_reason text, price_tier text, dealer_code text unique,
  zoho_account_id text unique, staff_limit int default 5,
  approved_at timestamptz, created_at timestamptz default now())

staff_invites(id uuid pk default gen_random_uuid(), dealer_id uuid not null references dealers(id),
  code_hash text not null, expires_at timestamptz not null,
  used_by uuid references users(id), used_at timestamptz,
  revoked bool default false, created_at timestamptz default now())

refresh_tokens(id uuid pk default gen_random_uuid(), user_id uuid not null references users(id),
  token_hash text not null, expires_at timestamptz not null,
  revoked bool default false, created_at timestamptz default now())

otp_codes(id uuid pk default gen_random_uuid(), user_id uuid references users(id),
  code_hash text not null, expires_at timestamptz not null,
  attempts int default 0, created_at timestamptz default now())

audit_log(id bigserial pk, actor_id uuid, action text not null,
  target_type text, target_id text, meta jsonb, created_at timestamptz default now())

webhook_events(id uuid pk default gen_random_uuid(), source text not null,
  ref_id text, payload_hash text not null, processed_at timestamptz default now())

catalog_cache(key text pk, data jsonb not null, fetched_at timestamptz not null)

sync_state(key text pk, value text not null)  -- e.g. last_crm_poll_at
```

(Depending on migration authoring the FK from `users.dealer_id` to `dealers` may be added
via a second migration to keep table order clean.)

## 6. Decision record — why this stack

### Database: Supabase (chosen over Postgres-elsewhere and Firebase)

- The schema is **relational** (users ↔ dealers ↔ invites, FKs, jsonb audit metadata,
  webhook dedup). Supabase **is hosted Postgres**: the exact schema above runs natively.
- **Firebase/Firestore is a NoSQL document store** — no joins, no FKs, no unique constraints
  across collections; this schema would fight the tool and cost more reads.
- **Plain managed Postgres (Neon/Render)** would also work, but Supabase adds a dashboard,
  backups and a pooled connection string (works well with serverless clients and long-running
  services alike) at zero extra ops.
- **Portability:** because we use Supabase purely as Postgres (NOT Supabase Auth — the
  backend owns all credentials and JWTs), moving to any other Postgres later is a SQL dump
  and a connection-string change.

### Runtime: dedicated Node.js 20 service (chosen over extending Vercel serverless)

- This portal is built **to scale**: webhook intake, a 5-minute poll job, scheduled catalog
  sync, in-memory catalog caching, and real rate limiting all want a **long-running process**.
  Serverless functions cold-start per request, cannot hold a warm catalog cache, and cron
  there is limited.
- An Express service on **Railway** (India region; Render as fallback) scales horizontally,
  runs cron internally, and keeps one deploy pipeline per concern: Vercel keeps serving the
  frontend + the existing Zoho Commerce product proxy (`api/` untouched), the Node service
  owns identity/roles/prices.
- The existing product proxy can migrate into this service later (optional, non-blocking).

## 7. Service layout

```
backend/
  src/
    config/        env loading, constants
    db/            migrations (SQL), connection pool
    routes/        auth, dealers, staff, prices, webhooks, health
    services/      auth, dealerApp, crmClient, catalog, notifications
    middleware/    jwtAuth, roleGate, rateLimit, errorHandler
    jobs/          crmPoll (5-min), catalogSync, tokenCleanup
    utils/         audit, logger
  test/            unit + integration (node --test)
```

Environment variables (backend `.env`, never committed):

```
DATABASE_URL=            # Supabase pooled connection string
JWT_SECRET=
ZOHO_DC=in
ZOHO_CRM_CLIENT_ID=      # CRM Self Client (separate from Commerce client)
ZOHO_CRM_CLIENT_SECRET=
ZOHO_CRM_REFRESH_TOKEN=
ZOHO_CRM_ORG_ID=
```

## 8. Phased delivery

1. **Backend** — build per §2/§7.
2. **Test** — unit (`node --test`): auth, token rotation, invite expiry, webhook dedup,
   role gating; integration: apply → webhook → approve with a mocked CRM client; negative
   tests: replayed webhook ignored once, revoked staff token fails, customer gets MRP-only,
   zero price → `price_on_request` (never ₹0).
3. **Frontend** — real auth replaces the demo in `src/data/session.js`; tokens in Capacitor
   secure storage; new screens (signup, apply-as-dealer, staff login, pending-approval
   polling `/me`, dealer dashboard). The `?from=` share-link and customer-view logic in
   [ROLES-AND-SHARING.md](ROLES-AND-SHARING.md) must keep working unchanged.
4. **Zoho wiring** — create the CRM fields and Self Client per §1, connect the workflow
   webhook, and run one real dealer application through to approval.

## 9. Migration checklist

- [x] Backend service built (`backend/`): auth, JWT + refresh rotation, OTP,
      dealer applications, CRM client, approval webhook + dedup, 5-min fallback
      poll, staff invites, role-gated price proxy, rate limits, audit log
- [x] Tests: 18 unit + 8 integration (`TEST_DATABASE_URL=... npm test`) — 26/26 pass
      against a real Postgres (verify the whole apply → webhook → approve → price flow)
- [x] Frontend wired: `src/data/auth.js` (token storage + auto-refresh),
      `session.js` mirrors `/api/auth/me`, Login (password/OTP/signup/apply/staff
      invite), `/dealer` dashboard, pending-approval polling
- [ ] Supabase project created; `DATABASE_URL` issued; `npm run migrate` applied
- [ ] Backend deployed (Railway); `FRONTEND_ORIGINS` set to the live domain
- [ ] CRM custom fields created (§1.1)
- [ ] CRM Self Client + `ZohoCRM.modules.ALL` refresh token in backend env only
- [ ] Approval workflow rule → webhook URL configured in CRM (plus `X-Webhook-Secret`)
- [ ] One real dealer application: apply → CRM Account/Contact → approve → webhook →
      dealer sees dealer prices
- [ ] Webhook killed manually; fallback poll converges within 5 minutes
- [ ] `?from=` share link still forces customer view for all viewers
- [ ] Price proxy switch: move price reads to `GET /api/prices`, drop `dealerRate`
      from the Vercel `/api/products` payload (closes the client-side masking seam)
