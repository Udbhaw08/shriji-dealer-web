# CLAUDE.md — read this before touching anything

Project: **Shriji Domestic Appliances — Sunshine dealer web/app (first draft, pitch build).**
This file is the entry point for any AI agent working in this repo. Read it fully, then read
whichever doc below covers your task. Do not infer facts about this business from the code alone.

## Doc map

| Doc | What it holds |
|---|---|
| [CODEBASE.md](CODEBASE.md) | **Master codebase reference.** Auto-generated map of routes, components, API endpoints, data models, and features. |
| [docs/PRICING-ARCHITECTURE.md](docs/PRICING-ARCHITECTURE.md) | **Pricing engine specification.** Priority hierarchy, zero-price resolution, CSV audit methodology, regression protection. |
| [docs/ZOHO-INTEGRATION.md](docs/ZOHO-INTEGRATION.md) | Live Zoho Commerce & Books backend architecture, OAuth v2 auto-recovery, and endpoints. |
| [PRD.md](PRD.md) | The master product requirements doc. Business, users, scope, current state, roadmap, decision log. |
| [docs/DESIGN.md](docs/DESIGN.md) | Design system: tokens, components, layout rules, what to reuse instead of inventing. |
| [docs/PRODUCT-PAGES.md](docs/PRODUCT-PAGES.md) | Deep spec of the product listing + product detail pages. |
| [docs/ROLES-AND-SHARING.md](docs/ROLES-AND-SHARING.md) | **Who sees which price.** Roles, login, approval, and the customer share link. Read before touching pricing or auth. |

## Hard rules (these exist to stop hallucination)

1. **The catalogue is live.** Connected directly to Zoho Commerce Store API (`433 items`). Do NOT hardcode or static-copy items.
2. **Prices are 100% real.** Sourced live from Zoho Store API (`label_rate > rate > min_rate`). Never re-introduce synthetic hash prices.
3. **Zero-price items render "Price on Request".** If a product has no price or 0 in Zoho, it must display "Price on Request" with contact options.
4. **MRP is shown to customers; dealer wholesale rates are gated.** Approved dealers view their wholesale rate masked behind "View Dealer Price". Customers only see MRP.
5. **A `?from=` share link forces the customer view for everyone**, including the dealer who sent it.
6. **Keep `CODEBASE.md` synchronized.** Run `npm run docs` whenever new features, routes, or files are created or changed.

## Commands

```bash
npm run dev                    # vite dev server
npm test                       # run automated pricing & dealer regression test suite
npm run build                  # production build
npm run docs                   # regenerate CODEBASE.md
node scripts/audit_prices.mjs  # audit 433 live API products against CSV export
```
