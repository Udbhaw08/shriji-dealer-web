---
name: shriji-zoho-integration
description: >-
  Use this skill when working with Zoho Commerce & Books API, syncing products,
  fetching individual products, pricebook lookups, dealer login, dealer applications,
  or backend API endpoints in api/zoho.js and vite.config.js.
---

# Shriji Zoho Integration Skill

This skill provides the runbook and architecture for the live Zoho Commerce and Books integration in Shriji Dealer Web.

## Key Files & Architecture
- **`api/zoho.js`**: Core backend connector handling Zoho OAuth v2 auto-recovery, product fetching, pricebooks, dealer lookups, and contact creation.
- **`vite.config.js`**: Local development middleware (`zohoApiPlugin`) intercepting `/api/*` routes and delegating to `api/zoho.js`.
- **`api/products/[id].js`**: Production Vercel serverless function for single product lookup.
- **`src/data/productsStore.jsx`**: Client-side React context caching Zoho catalogue and sync state.

## API Endpoints Reference

| Endpoint | Method | Purpose | Key Params / Body |
|---|---|---|---|
| `/api/products` | GET | Full catalogue fetch (433+ items) | `?refresh=true`, `?pricebook_id=...` |
| `/api/products/:id` | GET | Single product by ID or URL slug | Path param `:id` |
| `/api/dealer/login` | POST | Authenticate dealer by phone/email | `{ "phone": "98XXXXXXXX" }` |
| `/api/dealer/apply` | POST | New dealer onboard application | `{ "shop": "...", "person": "...", "phone": "..." }` |
| `/api/dealer/info` | GET | Fetch dealer name/tier for shared links | `?id=<dealer_id>` |

## Pricing & Rate Priority
Live Zoho rate resolution order:
1. `label_rate` (if non-zero)
2. `rate` (standard rate)
3. `min_rate` (fallback rate)
4. **Never hardcode synthetic prices**: If resolved rate is `0` or missing, the product is treated as **Zero-Price / Price on Request**.

Default Dealer Pricebook ID: `3334672000000547177`.

## Validation & Audit Commands
```bash
# Audit live API products against CSV export to verify rates and mappings
node scripts/audit_prices.mjs

# Run automated tests to check pricing logic and regressions
npm test
```
