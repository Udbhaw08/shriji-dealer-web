# Zoho Integration Architecture

> 15 nodes · cohesion 0.18

## Key Concepts

- **productsStore.js** (12 connections) — `src/data/productsStore.js`
- **Products.jsx** (12 connections) — `src/pages/Products.jsx`
- **useProducts()** (8 connections) — `src/data/productsStore.js`
- **products.js** (3 connections) — `src/data/products.js`
- **Products()** (3 connections) — `src/pages/Products.jsx`
- **CATEGORIES** (2 connections) — `src/data/products.js`
- **emit()** (2 connections) — `src/data/productsStore.js`
- **fetchLiveProducts()** (2 connections) — `src/data/productsStore.js`
- **useProduct()** (2 connections) — `src/data/productsStore.js`
- **PRODUCTS** (1 connections) — `src/data/products.js`
- **listeners** (1 connections) — `src/data/productsStore.js`
- **loadCached()** (1 connections) — `src/data/productsStore.js`
- **storeState** (1 connections) — `src/data/productsStore.js`
- **Group()** (1 connections) — `src/pages/Products.jsx`
- **SORTS** (1 connections) — `src/pages/Products.jsx`

## Relationships

- [[Dealer Auth & Session Management]] (12 shared connections)
- [[Zoho Backend & Proxy Endpoints]] (2 shared connections)

## Source Files

- `src/data/products.js`
- `src/data/productsStore.js`
- `src/pages/Products.jsx`

## Audit Trail

- EXTRACTED: 52 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*