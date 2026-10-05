# Zoho Integration Architecture

> 53 nodes · cohesion 0.08

## Key Concepts

- **zoho.js** (31 connections) — `api/zoho.js`
- **audit_prices.mjs** (14 connections) — `scripts/audit_prices.mjs`
- **fetchZohoProductById()** (12 connections) — `api/zoho.js`
- **fetchZohoProducts()** (11 connections) — `api/zoho.js`
- **fetchZohoWithRetry()** (11 connections) — `api/zoho.js`
- **getZohoConfig()** (11 connections) — `api/zoho.js`
- **findDealerByPhone()** (9 connections) — `api/zoho.js`
- **vite.config.js** (9 connections) — `vite.config.js`
- **createDealerContact()** (8 connections) — `api/zoho.js`
- **getDealerById()** (8 connections) — `api/zoho.js`
- **fetchZohoCategories()** (7 connections) — `api/zoho.js`
- **getAccessToken()** (7 connections) — `api/zoho.js`
- **zohoApiPlugin()** (7 connections) — `vite.config.js`
- **fetchZohoPricebookItems()** (5 connections) — `api/zoho.js`
- **normalizeProduct()** (5 connections) — `api/zoho.js`
- **index.js** (4 connections) — `api/products/index.js`
- **test-zoho-api.mjs** (4 connections) — `scripts/test-zoho-api.mjs`
- **og.js** (3 connections) — `api/og.js`
- **fetchZohoPricebooks()** (3 connections) — `api/zoho.js`
- **loadEnv()** (3 connections) — `api/zoho.js`
- **apply.js** (3 connections) — `api/dealer/apply.js`
- **info.js** (3 connections) — `api/dealer/info.js`
- **login.js** (3 connections) — `api/dealer/login.js`
- **[id].js** (3 connections) — `api/products/[id].js`
- **handler()** (3 connections) — `api/products/index.js`
- *... and 28 more nodes in this community*

## Relationships

- No strong cross-community connections detected

## Source Files

- `api/dealer/apply.js`
- `api/dealer/info.js`
- `api/dealer/login.js`
- `api/og.js`
- `api/products/[id].js`
- `api/products/index.js`
- `api/zoho.js`
- `scripts/audit_prices.mjs`
- `scripts/test-zoho-api.mjs`
- `vite.config.js`

## Audit Trail

- EXTRACTED: 226 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*