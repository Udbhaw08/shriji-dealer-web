# Architecture Doc Generator

> 10 nodes · cohesion 0.29

## Key Concepts

- **session.js** (17 connections) — `src/data/session.js`
- **registerDealer()** (5 connections) — `src/data/dealer.js`
- **setSession()** (5 connections) — `src/data/session.js`
- **signOut()** (3 connections) — `src/data/session.js`
- **emit()** (2 connections) — `src/data/session.js`
- **load()** (2 connections) — `src/data/session.js`
- **GUEST** (1 connections) — `src/data/session.js`
- **revalidateSession()** (1 connections) — `src/data/session.js`
- **state** (1 connections) — `src/data/session.js`
- **subs** (1 connections) — `src/data/session.js`

## Relationships

- [[Dealer Auth & Session Management]] (9 shared connections)
- [[Zoho Backend & Proxy Endpoints]] (3 shared connections)

## Source Files

- `src/data/dealer.js`
- `src/data/session.js`

## Audit Trail

- EXTRACTED: 38 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*