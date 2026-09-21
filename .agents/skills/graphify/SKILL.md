---
name: graphify
description: >-
  Use this skill to navigate the project's knowledge graph in graphify-out/,
  query architecture and code relationships with minimal tokens, and update the graph.
---

# Graphify Knowledge Graph Skill

This project uses **Graphify** (`graphify-out/`) to turn the entire codebase, documentation, schemas, and API integration into a queryable AST + semantic knowledge graph.

## Why Use Graphify
Instead of reading 60+ files and consuming 50,000+ tokens to understand how components, pricing, or Zoho endpoints work, query the knowledge graph to extract a scoped subgraph in under 2,000 tokens.

## Primary Commands

### 1. Query the Graph (Context-Efficient)
Traverse the knowledge graph to find connected components, functions, data flows, and documentation:
```bash
graphify query "<question>"
```
Examples:
- `graphify query "How does dealer pricing work?"`
- `graphify query "Where is Zoho OAuth token auto-recovery handled?"`
- `graphify query "What components use PriceBlock?"`

Options:
- `--dfs`: Trace a specific depth-first path.
- `--budget <N>`: Cap token output (default: 2000).

### 2. Trace Relationships (Shortest Path)
Find how two concepts, files, or symbols are connected across the architecture:
```bash
graphify path "<A>" "<B>"
```
Example:
- `graphify path "PriceBlock" "dealer.js"`
- `graphify path "Login" "findDealerByPhone"`

### 3. Explain a Node or Symbol
Get a focused explanation of an abstraction and all its immediate inbound/outbound connections:
```bash
graphify explain "<concept>"
```
Examples:
- `graphify explain "priceFor()"`
- `graphify explain "fetchZohoWithRetry()"`

### 4. Update the Graph (AST Re-Extraction)
After modifying or adding files, update the graph without using any LLM tokens:
```bash
graphify update .
```
Or:
```bash
npm run graphify:update
```

## Key Output Artifacts in `graphify-out/`
- **`graphify-out/graph.json`**: GraphRAG-ready knowledge graph (nodes, edges, communities).
- **`graphify-out/GRAPH_REPORT.md`**: Human-readable architecture audit report (god nodes, community hubs, surprising connections).
- **`graphify-out/graph.html`**: Interactive D3 visual graph for browser inspection.
