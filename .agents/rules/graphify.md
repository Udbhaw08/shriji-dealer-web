---
trigger: always_on
description: Mandatory token-saving knowledge graph navigation for any task or codebase query.
---

# Automatic Codebase Context & Knowledge Graph Protocol

This project has an active Graphify knowledge graph in `graphify-out/`.
To prevent high token consumption and avoid hallucinating file locations or relationships, follow this protocol on **every** user request.

## Rule 1: Mandatory Knowledge Graph Lookup (Never Blindly Read Files)
Before calling `list_dir`, broad `grep_search`, or reading full raw files:
1. **Query First**: Run `graphify query "<user task keywords>"` via terminal.
   - This returns the exact target files, symbol names, line numbers, and dependent edges in under 2,000 tokens.
2. **Wiki Navigation**: For subsystem overview, check [`graphify-out/wiki/index.md`](file:///c:/Users/udbha/Desktop/Webstore/graphify-out/wiki/index.md) or the community article for that module:
   - `Dealer Auth & Session Management.md`
   - `Price Presentation & Product UI.md`
   - `Zoho Backend & Proxy Endpoints.md`
   - `Design System & UI Tokens.md`
   - `Roles & Customer Sharing Spec.md`
   - `Pricing Hierarchy & Zero-Leakage Spec.md`
3. **Trace Connections**: Use `graphify path "<ComponentA>" "<ComponentB>"` to trace data flows across layers.
4. **Inspect Symbols**: Use `graphify explain "<functionOrSymbol>"` for immediate inbound/outbound references.

## Rule 2: Precision File Viewing
- Once `graphify query` gives you the file path and line number, use `view_file` with `StartLine` and `EndLine` to read **only** the relevant lines.
- Never load entire 500+ line files when only a 30-line function is needed.

## Rule 3: Keep Graph Fresh After Modifying Code
- After editing code files in any session, run:
  ```bash
  graphify update .
  ```
  (or `npm run graphify:update`). This re-indexes AST nodes with 0 token cost and keeps the graph synchronized.
