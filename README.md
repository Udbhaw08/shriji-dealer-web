# Shriji Domestic Appliances — Sunshine Dealer Web

First-draft dealer website / web app for Shriji Domestic Appliances Pvt. Ltd., distributor of the
Sunshine India kitchen range. React + Vite, no backend — the draft runs entirely from local data.

```bash
npm install
npm run dev                    # http://localhost:5173
npm run build
npm run lint
node src/data/dealer.test.mjs  # pricing self-check
```

## Documentation

**Read [CLAUDE.md](CLAUDE.md) first** if you are an AI agent, or [PRD.md](PRD.md) if you are a
human picking this up.

| Doc | What it covers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Entry point and the rules that keep agents from inventing facts |
| [PRD.md](PRD.md) | Master PRD — business, users, scope, current state, roadmap, decision log |
| [PRODUCT.md](PRODUCT.md) | Original direction contract (visual direction, still binding) |
| [docs/DESIGN.md](docs/DESIGN.md) | Design tokens, components, layout and responsive rules |
| [docs/PRODUCT-PAGES.md](docs/PRODUCT-PAGES.md) | Product listing + detail spec |
| [docs/ROLES-AND-SHARING.md](docs/ROLES-AND-SHARING.md) | Roles, login, approval, and the customer share link |
| [docs/ZOHO-INTEGRATION.md](docs/ZOHO-INTEGRATION.md) | Connecting the real Zoho Commerce backend |

## Two things to know before you change anything

1. **All prices in this build are fake** and generated in `src/data/dealer.js`. The catalogue
   (162 products) is real. See PRD.md § Evidence Ledger for the full split.
2. **A dealer never sees MRP; nobody else ever sees a dealer price.** Business rules, not styling
   choices. See docs/ROLES-AND-SHARING.md.

## Layout

```
index.html              design direction note in an HTML comment
src/
  main.jsx              routes, scroll manager, app shell
  ui.jsx                header, footer, icon set, shared buttons
  styles.css            the entire design system (tokens + components)
  pages/                Home · Products · Product · Schemes · Support · Login
  components/           ProductCard · PriceBlock (dealer + customer views)
  data/                 products.js (real) · site.js (mostly real) · dealer.js (sample) · session.js
public/img/             product photography, downloaded from the Zoho CDN
web ref.jpeg            approved desktop mockup — source of truth for layout
mobile ref.jpeg         approved mobile mockup — source of truth for layout
```
