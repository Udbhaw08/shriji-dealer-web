# Architecture Doc Generator

> 10 nodes · cohesion 0.24

## Key Concepts

- **productsStore.js** (12 connections) — `src/data/productsStore.js`
- **products.js** (3 connections) — `src/data/products.js`
- **CATEGORIES** (2 connections) — `src/data/products.js`
- **emit()** (2 connections) — `src/data/productsStore.js`
- **fetchLiveProducts()** (2 connections) — `src/data/productsStore.js`
- **useProduct()** (2 connections) — `src/data/productsStore.js`
- **PRODUCTS** (1 connections) — `src/data/products.js`
- **listeners** (1 connections) — `src/data/productsStore.js`
- **loadCached()** (1 connections) — `src/data/productsStore.js`
- **storeState** (1 connections) — `src/data/productsStore.js`

## Relationships

- [[Dealer Auth & Session Management]] (5 shared connections)

## Source Files

- `src/data/products.js`
- `src/data/productsStore.js`

## Audit Trail

- EXTRACTED: 27 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*