# Shriji Dealer Web — Agent Guidelines

## Specialized Skills Available
The project includes progressive-disclosure skills in `.agents/skills/`:
- `graphify`: Knowledge graph querying (`graphify query`), token-efficient architecture navigation, and updates.
- `shriji-backend`: `backend/` Node service — auth/JWT, dealer applications, Zoho CRM sync & approval webhook, staff invites, price proxy, Supabase Postgres.
- `shriji-zoho-integration`: Zoho Commerce API, live sync, pricebooks, OAuth auto-recovery.
- `shriji-responsive-ui`: Design system, mobile-first responsiveness, zero-overflow rules.
- `shriji-pricing-and-roles`: MRP vs dealer price masking, ?from= customer link rules, 5+1 schemes.
- `shriji-testing-and-workflow`: npm run dev, test, build, docs generation, regression prevention.

## Hard Rules
1. **Live Catalogue & Real Prices**: Products are connected to live Zoho Store API (`label_rate > rate > min_rate`). Never hardcode mock items or synthetic prices.
2. **Zero-Price Items**: If a price is `0` or missing, display "Price on Request" (never ₹0).
3. **Role Gating**: Customers only see MRP. Dealer wholesale rates are masked behind "View Dealer Price". `?from=` links force customer view for all viewers.
4. **Mobile-First Layout**: Always maintain `overflow-x: clip;` and `min-width: 0;` constraints to prevent mobile browser zoom-out and horizontal panning.
5. **No Auto-Push**: Keep changes local. Never run `git push` unless explicitly requested.
6. **Sync Everything (Web, Mobile & Docs)**: Run `npm run sync` whenever components, routes, models, or styles change to automatically update `CODEBASE.md`, compile production assets, synchronize native `android/` and `ios/` Capacitor folders, and refresh the knowledge graph.
7. **Consult Knowledge Graph First**: When investigating architecture or cross-file flows, run `graphify query "<question>"` or check `graphify-out/GRAPH_REPORT.md` first to save context tokens before reading raw files. Run `graphify update .` after code changes.
