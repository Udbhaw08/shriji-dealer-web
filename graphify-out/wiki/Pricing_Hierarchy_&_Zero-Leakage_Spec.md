# Pricing Hierarchy & Zero-Leakage Spec

> 50 nodes · cohesion 0.08

## Key Concepts

- **zoho.js** (59 connections) — `api/_lib/zoho.js`
- **fetchZohoProductById()** (18 connections) — `api/_lib/zoho.js`
- **getZohoConfig()** (10 connections) — `api/_lib/zoho.js`
- **createDealerContact()** (9 connections) — `api/_lib/zoho.js`
- **fetchZohoWithRetry()** (9 connections) — `api/_lib/zoho.js`
- **syncRecentProductTags()** (7 connections) — `api/_lib/zoho.js`
- **fetchZohoPricebookItems()** (6 connections) — `api/_lib/zoho.js`
- **getAccessToken()** (6 connections) — `api/_lib/zoho.js`
- **normalizeProduct()** (6 connections) — `api/_lib/zoho.js`
- **readTagCache()** (6 connections) — `api/_lib/zoho.js`
- **resolvePricebookId()** (5 connections) — `api/_lib/zoho.js`
- **fetchZohoPricebooks()** (4 connections) — `api/_lib/zoho.js`
- **fetchZohoRawCategories()** (4 connections) — `api/_lib/zoho.js`
- **getDealerById()** (4 connections) — `api/_lib/zoho.js`
- **loadEnv()** (4 connections) — `api/_lib/zoho.js`
- **updateCachedProductTags()** (4 connections) — `api/_lib/zoho.js`
- **sync-tags.js** (4 connections) — `api/products/sync-tags.js`
- **test-zoho-api.mjs** (4 connections) — `scripts/test-zoho-api.mjs`
- **apply.js** (3 connections) — `api/dealer/apply.js`
- **getCachedProductTags()** (3 connections) — `api/_lib/zoho.js`
- **isItemOnline()** (3 connections) — `api/_lib/zoho.js`
- **readProductDetailsDiskCache()** (3 connections) — `api/_lib/zoho.js`
- **writeProductDetailDiskCache()** (3 connections) — `api/_lib/zoho.js`
- **handler()** (3 connections) — `api/products/sync-tags.js`
- **handler()** (2 connections) — `api/dealer/apply.js`
- *... and 25 more nodes in this community*

## Relationships

- [[Community 233]] (15 shared connections)
- [[Community 150]] (11 shared connections)
- [[Community 143]] (3 shared connections)
- [[Community 88]] (2 shared connections)
- [[Community 145]] (1 shared connections)

## Source Files

- `api/_lib/zoho.js`
- `api/dealer/apply.js`
- `api/products/sync-tags.js`
- `scripts/test-zoho-api.mjs`

## Audit Trail

- EXTRACTED: 220 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*