# Shriji Dealer Web — Agent Guidelines

## Specialized Skills Available
The project includes progressive-disclosure skills in `.agents/skills/`:
- `graphify`: Knowledge graph querying (`graphify query`), token-efficient architecture navigation, and updates.
- `shriji-zoho-integration`: Zoho Commerce API, live sync, pricebooks, OAuth auto-recovery.
- `shriji-responsive-ui`: Design system, mobile-first responsiveness, zero-overflow rules.
- `shriji-pricing-and-roles`: MRP vs dealer price masking, ?from= customer link rules, 5+1 schemes.
- `shriji-testing-and-workflow`: npm run dev, test, build, docs generation, regression prevention.
- `refero-design`: Visual hierarchy, modern typography scales, curated palettes, surfaces, micro-animations, anti-AI-slop.
- `apple-design`: 123-page Apple Human Interface Guidelines (HIG) reviewer, Liquid Glass materials, modality, sheets, and cross-platform design audits.
- `swiftui-pro`: Mobile app UX, ergonomics, touch target sizing (≥44pt), safe areas, HIG guidelines, native performance.

## Hard Rules
1. **Live Catalogue & Real Prices**: Products are connected to live Zoho Store API (`label_rate > rate > min_rate`). Never hardcode mock items or synthetic prices.
2. **Zero-Price Items**: If a price is `0` or missing, display "Price on Request" (never ₹0).
3. **Role Gating**: Customers only see MRP. Dealer wholesale rates are masked behind "View Dealer Price". `?from=` links force customer view for all viewers.
4. **Mobile-First Layout**: Always maintain `overflow-x: clip;` and `min-width: 0;` constraints to prevent mobile browser zoom-out and horizontal panning.
5. **Multi-Skill Redesign Synthesis**: Whenever redesigning any component or page, visit the design triad: `refero-design`, `apple-design`, and `swiftui-pro` (as detailed in `instructions.md`) to create unified, highly responsive desktop and mobile app experiences.
6. **No Auto-Push**: Keep changes local. Never run `git push` unless explicitly requested.
7. **Sync Everything (Web, Mobile & Docs)**: Run `npm run sync` whenever components, routes, models, or styles change to automatically update `CODEBASE.md`, compile production assets, synchronize native `android/` and `ios/` Capacitor folders, and refresh the knowledge graph.
8. **Consult Knowledge Graph First**: When investigating architecture or cross-file flows, run `graphify query "<question>"` or check `graphify-out/GRAPH_REPORT.md` first to save context tokens before reading raw files. Run `graphify update .` after code changes.
