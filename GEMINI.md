# Shriji Domestic Appliances — Sunshine Dealer Web

## Agent Operating Guidelines & Zero-Token Context Strategy

This project contains a pre-computed knowledge graph in `graphify-out/` representing all 376 nodes, 535 edges, and 29 community subsystems.

### Mandatory Context Rule: Knowledge Graph First
When starting any new task, bug fix, feature, or code exploration:
1. **Never read files blindly**: Do not browse directories or load full multi-hundred line files into prompt context.
2. **Run `graphify query` first**:
   ```bash
   graphify query "<feature / keywords>"
   ```
   This immediately identifies the exact files, line numbers, and connected symbols with minimal context tokens.
3. **Trace relationships**:
   ```bash
   graphify path "<ComponentA>" "<ComponentB>"
   graphify explain "<functionName>"
   ```
4. **Browse subsystem wiki**: Refer to `graphify-out/wiki/index.md` to navigate specific subsystem articles (e.g. Dealer Auth, Price Presentation, Zoho Backend).
5. **Update after changes**: Run `npm run graphify:update` (or `graphify update .`) whenever you modify code to keep the graph fresh.

### Project Hard Rules
1. **Live Catalogue & Real Prices**: Products are connected to live Zoho Store API (`label_rate > rate > min_rate`). Never hardcode mock items or synthetic prices.
2. **Zero-Price Items**: If a price is `0` or missing, display "Price on Request" (never ₹0).
3. **Role Gating**: Customers only see MRP. Dealer wholesale rates are masked behind "View Dealer Price". `?from=` links force customer view for all viewers.
4. **Mobile-First Layout**: Always maintain `overflow-x: clip;` and `min-width: 0;` constraints to prevent mobile browser zoom-out and horizontal panning.
5. **Dual-Skill Redesign Synthesis**: Whenever redesigning any component or page, visit both `refero-design` (website & visual design) and `swiftui-pro` (mobile app UX & ergonomics) as detailed in `instructions.md` to create unified, highly responsive desktop and mobile app experiences.
6. **No Auto-Push**: Keep changes local. Never run `git push` unless explicitly requested.
7. **Sync Everything (Web, Mobile & Docs)**: Run `npm run sync` whenever components, routes, models, or styles change to automatically update `CODEBASE.md`, compile production assets, synchronize native `android/` and `ios/` Capacitor folders, and refresh the knowledge graph.
