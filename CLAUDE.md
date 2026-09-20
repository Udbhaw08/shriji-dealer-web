# CLAUDE.md — read this before touching anything

Project: **Shriji Domestic Appliances — Sunshine dealer web/app (first draft, pitch build).**
This file is the entry point for any AI agent working in this repo. Read it fully, then read
whichever doc below covers your task. Do not infer facts about this business from the code alone.

## Doc map

| Doc | What it holds |
|---|---|
| [PRD.md](PRD.md) | The master product requirements doc. Business, users, scope, current state, roadmap, decision log. **Start here.** |
| [PRODUCT.md](PRODUCT.md) | The original direction contract written by the `impeccable` skill at project birth. Historical, still binding on visual direction. |
| [docs/DESIGN.md](docs/DESIGN.md) | Design system: tokens, components, layout rules, what to reuse instead of inventing. |
| [docs/PRODUCT-PAGES.md](docs/PRODUCT-PAGES.md) | Deep spec of the product listing + product detail pages. The current focus of the project. |
| [docs/ROLES-AND-SHARING.md](docs/ROLES-AND-SHARING.md) | **Who sees which price.** Roles, login, approval, and the customer share link. Read before touching pricing or auth. |
| [docs/ZOHO-INTEGRATION.md](docs/ZOHO-INTEGRATION.md) | How the Zoho Commerce backend will be wired in, what credentials are needed, and where the seams already are. |

## Hard rules (these exist to stop hallucination)

1. **Never invent business facts.** Prices, testimonials, dealer names, certifications, warranty
   terms, awards, GST numbers, review counts and star ratings for this company do **not** exist in
   any verified source. If you need one, generate it through the sample-data helpers in
   `src/data/dealer.js` and label it as sample, or ask the user.
2. **Real vs sample data is tracked in PRD.md § Evidence Ledger.** Check that table before stating
   anything as fact. Anything not in it is unverified.
3. **The catalogue is real.** The 162 products in `src/data/products.js` were scraped from
   shrijidomestic.com on 2026-09-18. Do not add, rename or pad SKUs.
4. **Prices are fake and deliberately so.** Every rupee figure in the app comes from
   `priceFor()` in `src/data/dealer.js`, a deterministic hash of the product id. It is a
   placeholder for Zoho. Do not hardcode a price anywhere else.
5. **MRP is never shown to a dealer, and a dealer price is never shown to anyone else.** See
   `docs/ROLES-AND-SHARING.md`. These are business rules the user stated explicitly, not styling
   preferences. A `?from=` share link forces the customer view for **everyone**, including the
   dealer who sent it — do not add an exception for that case, it is deliberate.
6. **No new dependencies.** Stack is React + Vite + react-router-dom and hand-written CSS. If you
   think you need a library, you almost certainly do not — check `src/styles.css` first, the
   component you want probably already has a class.
7. **Design comes from two mockup images** in the repo root: `web ref.jpeg` and `mobile ref.jpeg`.
   They are the source of truth for layout. Read them before redesigning anything.
8. **Say when something is missing.** If a doc and the code disagree, trust the code, then fix the
   doc and note the change in PRD.md § Decision log. Do not silently pick one.

## Commands

```bash
npm run dev                    # vite dev server
npm run build                  # production build
npm run lint                   # oxlint
node src/data/dealer.test.mjs  # pricing self-check (162 products)
```

Pre-existing lint warnings live in `src/main.jsx`, `src/ui.jsx` and `src/pages/Support.jsx`.
They are known and out of scope; do not "fix" them as a side quest.
