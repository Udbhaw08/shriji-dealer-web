# Vercel Deployment Routing

> 43 nodes · cohesion 0.09

## Key Concepts

- **session.js** (60 connections) — `src/data/session.js`
- **productsStore.js** (25 connections) — `src/data/productsStore.js`
- **apiFetch()** (21 connections) — `src/data/api.js`
- **setSession()** (13 connections) — `src/data/session.js`
- **api.js** (12 connections) — `src/data/api.js`
- **apiUrl()** (9 connections) — `src/data/api.js`
- **syncPricebookWithSession()** (8 connections) — `src/data/productsStore.js`
- **signOut()** (8 connections) — `src/data/session.js`
- **registerDealer()** (7 connections) — `src/data/dealer.js`
- **fetchLiveProducts()** (7 connections) — `src/data/productsStore.js`
- **setIncognitoMode()** (7 connections) — `src/data/session.js`
- **isIncognitoMode()** (6 connections) — `src/data/session.js`
- **loadCachedSession()** (6 connections) — `src/data/session.js`
- **products.js** (5 connections) — `src/data/products.js`
- **applyIncognito()** (5 connections) — `src/data/session.js`
- **switchToDealerSession()** (5 connections) — `src/data/session.js`
- **getAccessToken()** (4 connections) — `src/data/auth.js`
- **loadCached()** (4 connections) — `src/data/productsStore.js`
- **switchToViewerSession()** (4 connections) — `src/data/session.js`
- **toggleIncognitoMode()** (4 connections) — `src/data/session.js`
- **sessionFromAuth()** (3 connections) — `src/data/auth.js`
- **emit()** (3 connections) — `src/data/productsStore.js`
- **syncTagsLive()** (3 connections) — `src/data/productsStore.js`
- **emit()** (3 connections) — `src/data/session.js`
- **onAuthBroadcast()** (2 connections) — `src/data/auth.js`
- *... and 18 more nodes in this community*

## Relationships

- [[Live Pricing Audit Tool]] (26 shared connections)
- [[Community 30]] (24 shared connections)
- [[Community 48]] (24 shared connections)
- [[Product Brand & Business Vision]] (18 shared connections)
- [[Community 59]] (3 shared connections)

## Source Files

- `src/data/api.js`
- `src/data/auth.js`
- `src/data/dealer.js`
- `src/data/products.js`
- `src/data/productsStore.js`
- `src/data/session.js`

## Audit Trail

- EXTRACTED: 257 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*