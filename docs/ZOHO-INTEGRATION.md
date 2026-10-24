# ZOHO-INTEGRATION.md — Live Zoho Commerce & Books Backend

The site (shrijidomestic.com) is fully integrated with **Zoho Commerce Store API** and **Zoho Books API** via `api/zoho.js`.
**Status: Implemented & Active in Production.**

> **Zoho CRM & the dealer-approval backend:** the new `backend/` Node service adds a CRM
> integration (dealer Accounts/Contacts, approval webhook, `ZohoCRM.modules.ALL` Self Client).
> That setup lives in [BACKEND-ARCHITECTURE.md](BACKEND-ARCHITECTURE.md) §1 — this doc covers
> the Commerce/Books integration only.

---

## 1. Active Integration Summary

| Feature | Source / Endpoint | Implementation |
|---|---|---|
| Product catalogue (433 items) | `https://commerce.zoho.in/store/api/v1/products` | Live sync via `fetchZohoProducts` |
| Product categories | `https://commerce.zoho.in/store/api/v1/categories` | Live sync via `fetchZohoCategories` |
| Product detail & variants | `https://commerce.zoho.in/store/api/v1/products/:id` | Live sync via `fetchZohoProductById` |
| Product images | Zoho CDN (`cdn2.zohoecommerce.com`) | Normalized 600x600 high-res URLs |
| **Retail MRP** | Zoho Variant `label_rate` / `rate` / `min_rate` | Normalized in `normalizeProduct` |
| **Dealer Login & Identity** | `https://www.zohoapis.in/books/v3/contacts` | Search by mobile/phone/email |
| **Dealer Pricebooks** | Zoho Books Contact `pricebook_id` & `pricebook_name` | Integrated in `findDealerByPhone` |
| **Token Resilience** | Zoho OAuth v2 token refresh | Auto-recovers on 401 via `fetchZohoWithRetry` |

---

## 2. The Code Seams

Every rupee figure and identity in the app flows cleanly through:
```
api/zoho.js         →  fetchZohoProducts(), fetchZohoCategories(), findDealerByPhone(), getDealerById()
src/data/dealer.js  →  priceFor(), tagFor(), inr(), viewerFor(), isDealer()
src/data/session.js →  useSession(), loginAsDealer(), logout()
```
No static prices are hardcoded anywhere in the codebase. All prices are calculated dynamically from the live Zoho Store API.

## 3. Exactly which keys to fetch, and from where

Verified against the Zoho Commerce API docs on 2026-09-20 (sources at the bottom of this file).
Three things are needed: an **Organization ID**, a **Client ID + Secret**, and a **Refresh Token**.

### 3.1 Organization ID — from the Commerce dashboard

Every Commerce API request is scoped to one store by its Organization ID, sent as a header.

Zoho does not surface it in a settings screen. The documented way to read it:

1. Sign in to the Zoho Commerce dashboard for shrijidomestic.com
2. Open the browser developer console (F12)
3. Type `app.data.books_org_id` and press Enter
4. The number it prints is the Organization ID

It is a plain numeric id, not a secret, e.g. `682219181` in Zoho's own example.

### 3.2 Client ID + Client Secret — from the API console, not the store

This is the step people look for in the Commerce dashboard and never find. **API credentials do
not live in the Commerce admin.** They are created in Zoho's shared API console:

1. Go to **https://api-console.zoho.com/** signed in with the same Zoho account that owns the store
2. **ADD CLIENT** → choose **Self Client** (right choice for a server-to-server integration with
   no end-user login; if the app will one day log dealers in through Zoho, choose **Server-based
   Application** instead and set a redirect URI)
3. Fill in a client name and homepage URL; for a server-based client also add an Authorized
   Redirect URI such as `https://localhost:5173/callback` (placeholder values are accepted)
4. **CREATE** → the console shows the **Client ID** and **Client Secret**. The secret is the one
   real credential here — treat it like a password

### 3.3 Refresh Token — generated once, then permanent

**Self Client route (simplest):** in the API console, open the client → **Generate Code** tab →
paste the scopes → pick a duration (10 minutes is enough) → describe it → it returns a
`grant_token` / authorization code. Exchange that code for tokens within its lifetime:

```bash
curl -X POST "https://accounts.zoho.in/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "code=<GRANT_TOKEN>"
```

The response contains a short-lived `access_token` and a **permanent `refresh_token`**. Save the
refresh token; the access token is regenerated from it as needed:

```bash
curl -X POST "https://accounts.zoho.in/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=<REFRESH_TOKEN>" \
  -d "client_id=<CLIENT_ID>" -d "client_secret=<CLIENT_SECRET>"
```

Two limits worth knowing: a user may hold at most **20 refresh tokens** (the oldest is dropped
silently past that), and the authorization code expires in minutes — regenerate it rather than
debugging a stale one.

### 3.4 Scopes

Scopes follow `ZohoCommerce.<resource>.<operation>`, comma-separated, e.g. the documented
`ZohoCommerce.salesorders.all`. For this app, read-only on products and settings is enough —
something in the shape of:

```
ZohoCommerce.products.READ,ZohoCommerce.settings.READ
```

**Confirm the exact resource names in the console's scope picker before generating the token.**
A wrong scope string fails at request time with an unhelpful error, not at generation time.

### 3.5 Data centre

If the Zoho account is Indian, every `accounts.zoho.com` above becomes `accounts.zoho.in`. A
mismatched data centre is the most common cause of a confusing `invalid_client` error. Check which
domain the browser is on while signed into Zoho.

### 3.6 The API call the keys unlock

```bash
curl -X GET "https://commerce.zoho.com/store/api/v1/products" \
  -H "Authorization: Zoho-oauthtoken <ACCESS_TOKEN>" \
  -H "X-com-zoho-store-organizationid: <ORG_ID>"
```

Related endpoints: `/store/api/v1/products/<id>` for one product, `/store/api/v1/categories` for
the category tree.

### 3.7 Still to confirm — only the store owner can answer

1. **Where does dealer pricing live?** Commerce price lists / customer groups, or Zoho
   Books/Inventory Price Lists? This decides which API the integration calls, and the answer is a
   property of how the store was set up, not of the docs.
2. **How is a dealer identified?** Is each dealer a Zoho contact with a price list attached? Will
   this app own login, or reuse a Zoho one?
3. **One worked example**, exported from the admin: a single product with its MRP and the price one
   named dealer actually pays. One real example resolves more ambiguity than any amount of
   documentation reading.

### How to hand the credentials over safely

**Do not paste the Client Secret or Refresh Token into a chat, a file in this repo, or a commit.**
Put them in `.env.local` (already covered by the `*.local` rule in .gitignore) and share only the variable
names:

```
ZOHO_DC=in
ZOHO_ORG_ID=...
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_REFRESH_TOKEN=...
```

If a secret does leak into a shared surface, revoke and regenerate it in the API console — deleting
the message is not enough.

## 4. Architecture — the part that cannot be skipped

**The client secret and refresh token can never live in the browser bundle.** A Vite app ships
every `import.meta.env` value it references to the client, so a frontend-only integration would
publish the keys to the Zoho account.

So the integration needs a small server piece. Two credible options:

**A. Thin proxy (recommended for this project).** A serverless function or tiny Node service that
holds the Zoho credentials, exchanges the refresh token for access tokens, and exposes exactly two
endpoints to the app:

```
GET /api/products              → catalogue + MRP
GET /api/price?ids=a,b,c       → dealer prices for the signed-in dealer
```

This keeps the React app unchanged in shape — `priceFor` becomes a lookup into fetched data — and
keeps the dealer-price rule enforceable on the server, where a customer cannot bypass it.

**B. Build-time snapshot.** A script pulls the catalogue and MRPs at build time into
`src/data/products.js`. Simple, no runtime backend — but it cannot do per-dealer pricing, so it
only solves half the problem. Reasonable as a first step if login is still far off.

**Security rule that survives either choice:** dealer pricing is returned only for the
authenticated dealer's own account, and the server decides that. Never let the client ask for
"the price for account X".

## 5. API surface

- **Auth:** OAuth 2.0 refresh-token grant at `https://accounts.zoho.{dc}/oauth/v2/token`. Access
  tokens are short-lived — cache and refresh them server-side, never in the browser.
- **Catalogue:** `GET https://commerce.zoho.com/store/api/v1/products`, with
  `Authorization: Zoho-oauthtoken <token>` and `X-com-zoho-store-organizationid: <org id>`.
- **Storefront portal APIs** are registered separately, at
  `https://api-console.zoho.com/portal/<PORTAL_ID>`, and authorize through
  `accounts.zohoportal.com`. Only relevant if the app ends up logging dealers in as storefront
  customers.
- **Dealer pricing** is the part most likely to sit in Inventory/Books Price Lists rather than
  Commerce. Confirm § 3.7 question 1 before writing any client code.

### Sources

- [Client registration](https://www.zoho.com/commerce/api/oauth-step-1.html) ·
  [Authorization](https://www.zoho.com/commerce/api/oauth-step-2.html) ·
  [Access + refresh token](https://www.zoho.com/commerce/api/oauth-step-3.html) ·
  [Refreshing](https://www.zoho.com/commerce/api/oauth-step-4.html)
- [Organization id](https://www.zoho.com/commerce/api/organization.html) ·
  [Header code](https://www.zoho.com/commerce/api/header-code.html) ·
  [List all products](https://www.zoho.com/commerce/api/list-all-products.html)

## 6. Migration checklist

- [ ] Confirm data centre, org id, and where dealer pricing lives
- [ ] Create the self-client app, generate a refresh token with read-only scopes
- [ ] Stand up the proxy; verify one product's MRP end to end
- [ ] Verify one dealer's contract price for that same product
- [ ] Replace `priceFor()` with a lookup into fetched data; keep the same return shape
      `{ mrp, dealer, rebatePct }` so no component changes
- [ ] Replace `ACCOUNT` with the signed-in dealer
- [ ] Replace `tagFor()` with real Zoho tags/collections, or drop the ribbons
- [ ] Pull real multi-image galleries and remove the sibling-photo placeholder in
      `src/pages/Product.jsx`
- [ ] Update `node src/data/dealer.test.mjs` — the hash assertions go away, but keep the invariant
      that dealer price never exceeds MRP
- [ ] Update [PRD.md](../PRD.md) § Evidence Ledger: prices move from sample to real
