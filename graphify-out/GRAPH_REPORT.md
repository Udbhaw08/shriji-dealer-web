# Graph Report - .  (2026-09-22)

## Corpus Check
- 62 files · ~56,751 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 404 nodes · 623 edges · 31 communities (28 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dealer Auth & Session Management|Dealer Auth & Session Management]]
- [[_COMMUNITY_Price Presentation & Product UI|Price Presentation & Product UI]]
- [[_COMMUNITY_Zoho Backend & Proxy Endpoints|Zoho Backend & Proxy Endpoints]]
- [[_COMMUNITY_Dependencies & Package Config|Dependencies & Package Config]]
- [[_COMMUNITY_Product Pages Specification|Product Pages Specification]]
- [[_COMMUNITY_Master Codebase Architecture Reference|Master Codebase Architecture Reference]]
- [[_COMMUNITY_Design System & UI Tokens|Design System & UI Tokens]]
- [[_COMMUNITY_Product Requirements Documentation|Product Requirements Documentation]]
- [[_COMMUNITY_Pricing Regression Test Suite|Pricing Regression Test Suite]]
- [[_COMMUNITY_Zoho Integration Architecture|Zoho Integration Architecture]]
- [[_COMMUNITY_Client Products Data Store|Client Products Data Store]]
- [[_COMMUNITY_Product Brand & Business Vision|Product Brand & Business Vision]]
- [[_COMMUNITY_Live Pricing Audit Tool|Live Pricing Audit Tool]]
- [[_COMMUNITY_Architecture Doc Generator|Architecture Doc Generator]]
- [[_COMMUNITY_Roles & Customer Sharing Spec|Roles & Customer Sharing Spec]]
- [[_COMMUNITY_Pricing Hierarchy & Zero-Leakage Spec|Pricing Hierarchy & Zero-Leakage Spec]]
- [[_COMMUNITY_Graphify Knowledge Graph Skill|Graphify Knowledge Graph Skill]]
- [[_COMMUNITY_Pricing & Roles Skill|Pricing & Roles Skill]]
- [[_COMMUNITY_Mobile Responsive UI Skill|Mobile Responsive UI Skill]]
- [[_COMMUNITY_Oxlint Linter Configuration|Oxlint Linter Configuration]]
- [[_COMMUNITY_Zoho Integration Skill|Zoho Integration Skill]]
- [[_COMMUNITY_Claude Agent Instructions|Claude Agent Instructions]]
- [[_COMMUNITY_Project Readme & Layout|Project Readme & Layout]]
- [[_COMMUNITY_Agent Guidelines (AGENTS.md)|Agent Guidelines (AGENTS.md)]]
- [[_COMMUNITY_Zoho API Diagnostic Script|Zoho API Diagnostic Script]]
- [[_COMMUNITY_Testing & Workflow Skill|Testing & Workflow Skill]]
- [[_COMMUNITY_Vercel Deployment Routing|Vercel Deployment Routing]]
- [[_COMMUNITY_Graphify Agent Rules|Graphify Agent Rules]]
- [[_COMMUNITY_Graphify Workflow|Graphify Workflow]]
- [[_COMMUNITY_Community 29|Community 29]]

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 24 edges
2. `t()` - 15 edges
3. `Product` - 12 edges
4. `fetchZohoWithRetry()` - 11 edges
5. `getZohoConfig()` - 11 edges
6. `PRD — Shriji Domestic Appliances Dealer Web` - 11 edges
7. `fetchZohoProducts()` - 10 edges
8. `Product()` - 10 edges
9. `Icon()` - 10 edges
10. `findDealerByPhone()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `fetchZohoProducts()`  [EXTRACTED]
  scripts/audit_prices.mjs → api/zoho.js
- `zohoApiPlugin()` --calls--> `findDealerByPhone()`  [EXTRACTED]
  vite.config.js → api/zoho.js
- `zohoApiPlugin()` --calls--> `getDealerById()`  [EXTRACTED]
  vite.config.js → api/zoho.js
- `zohoApiPlugin()` --calls--> `createDealerContact()`  [EXTRACTED]
  vite.config.js → api/zoho.js
- `zohoApiPlugin()` --calls--> `fetchZohoCategories()`  [EXTRACTED]
  vite.config.js → api/zoho.js

## Import Cycles
- None detected.

## Communities (31 total, 3 thin omitted)

### Community 0 - "Dealer Auth & Session Management"
Cohesion: 0.10
Nodes (42): PriceBlock(), ProductCard(), UnderMaintenance(), tagFor(), currentLang, emit(), listeners, setLanguage() (+34 more)

### Community 1 - "Price Presentation & Product UI"
Cohesion: 0.08
Nodes (33): CustomerPrice(), DealerPrice(), BAND, dealerById(), DEALERS, inr(), isDealer(), price99() (+25 more)

### Community 2 - "Zoho Backend & Proxy Endpoints"
Cohesion: 0.14
Nodes (27): cachedPricebooks, clearDiskCache(), createDealerContact(), fetchZohoCategories(), fetchZohoPricebookItems(), fetchZohoPricebooks(), fetchZohoProductById(), fetchZohoProducts() (+19 more)

### Community 3 - "Dependencies & Package Config"
Cohesion: 0.09
Nodes (22): dependencies, react, react-dom, react-router-dom, devDependencies, oxlint, @types/react, @types/react-dom (+14 more)

### Community 4 - "Product Pages Specification"
Cohesion: 0.10
Nodes (19): 1. Price visibility — the rule everything else follows, 2. The pricing module — `src/data/dealer.js`, 3. `<PriceBlock>` — `src/components/PriceBlock.jsx`, 4. Product listing — `/products`, `src/pages/Products.jsx`, 5. Product card — `src/components/ProductCard.jsx`, 6. Product detail — `/products/:id`, `src/pages/Product.jsx`, 7. What is deliberately not here, 8. Files touched on 2026-09-20 (+11 more)

### Community 5 - "Master Codebase Architecture Reference"
Cohesion: 0.11
Nodes (18): 1. System Overview, 2.1 The Two Audiences (Zero Leakage Rule), 2.2 Pricing Resolution Engine (`api/zoho.js` & `src/data/dealer.js`), 2. Core Pricing & Identity Architecture, 3. Application Routes & Navigation, 4.1 Pages (`src/pages/`), 4.2 Reusable Components (`src/components/` & `src/ui.jsx`), 4.3 State & Business Logic (`src/data/`) (+10 more)

### Community 6 - "Design System & UI Tokens"
Cohesion: 0.11
Nodes (17): 1. The direction in one paragraph, 2. Tokens, 3. Layout primitives, 4. Components already built — reuse these, 5. Icons, 6. Responsive rules, 7. Motion and accessibility, Actions (+9 more)

### Community 7 - "Product Requirements Documentation"
Cohesion: 0.11
Nodes (17): 10. Conventions worth knowing, 1. What this is, 2. Who uses it, 3. Scope, 4. Stack, 5. The pricing model — the core business rule, 6. Data, 7. Evidence ledger — what is verified vs. what is sample (+9 more)

### Community 8 - "Pricing Regression Test Suite"
Cohesion: 0.12
Nodes (16): 1. Active Integration Summary, 2. The Code Seams, 3.1 Organization ID — from the Commerce dashboard, 3.2 Client ID + Client Secret — from the API console, not the store, 3.3 Refresh Token — generated once, then permanent, 3.4 Scopes, 3.5 Data centre, 3.6 The API call the keys unlock (+8 more)

### Community 9 - "Zoho Integration Architecture"
Cohesion: 0.15
Nodes (12): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+4 more)

### Community 10 - "Client Products Data Store"
Cohesion: 0.15
Nodes (11): content, csvItems, idIdx, lines, lpIdx, nameIdx, parsedHeader, run() (+3 more)

### Community 11 - "Product Brand & Business Vision"
Cohesion: 0.18
Nodes (9): allFiles, apiFiles, components, dataStores, pages, pkg, rootDir, routes (+1 more)

### Community 12 - "Live Pricing Audit Tool"
Cohesion: 0.29
Nodes (8): registerDealer(), emit(), GUEST, load(), setSession(), signOut(), state, subs

### Community 13 - "Architecture Doc Generator"
Cohesion: 0.24
Nodes (7): CATEGORIES, PRODUCTS, emit(), fetchLiveProducts(), listeners, storeState, useProduct()

### Community 14 - "Roles & Customer Sharing Spec"
Cohesion: 0.20
Nodes (9): 1. The four viewers, 2. The rule, in one function, 3. ⚠️ What this is not, 4. The share link, 5. What the customer sees — `CustomerPrice` in `PriceBlock.jsx`, 6. The login flow, 7. Also gated, 8. Checks (+1 more)

### Community 15 - "Pricing Hierarchy & Zero-Leakage Spec"
Cohesion: 0.22
Nodes (8): 1. Source of Truth: Live Zoho Commerce Store API, 2.1 Customer View, 2.2 Dealer View, 2.3 Share Link Invariant, 2. Customer vs. Dealer Price Resolution (`src/data/dealer.js`), 3. Automated Pricing Regression Protection, PRICING-ARCHITECTURE.md — Pricing Engine & Audit Specification, Rate Priority Hierarchy

### Community 16 - "Graphify Knowledge Graph Skill"
Cohesion: 0.22
Nodes (8): 1. Query the Graph (Context-Efficient), 2. Trace Relationships (Shortest Path), 3. Explain a Node or Symbol, 4. Update the Graph (AST Re-Extraction), Graphify Knowledge Graph Skill, Key Output Artifacts in `graphify-out/`, Primary Commands, Why Use Graphify

### Community 17 - "Pricing & Roles Skill"
Cohesion: 0.22
Nodes (8): 1. Guest View (Public), 2. Dealer View (Authenticated), 3. Customer Shared View (`?from=<dealer_id>`), Key Files, Schemes Logic, Shriji Pricing & Roles Skill, User Roles & View Modes, Zero-Price Handling

### Community 18 - "Mobile Responsive UI Skill"
Cohesion: 0.22
Nodes (8): 1. Viewport Zoom-Out Prevention, 2. CSS Grid Child Shrinking, 3. Product Card Rows on Mobile (`<= 719px`), 4. Horizontal Scrollable Tabs (`.utabs`, `.tabs`), 5. Hero Banner on Small Screens (`<= 640px`), Critical Mobile Responsiveness Safeguards, Design System Tokens, Shriji Responsive UI Skill

### Community 19 - "Oxlint Linter Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 20 - "Zoho Integration Skill"
Cohesion: 0.33
Nodes (5): API Endpoints Reference, Key Files & Architecture, Pricing & Rate Priority, Shriji Zoho Integration Skill, Validation & Audit Commands

### Community 21 - "Claude Agent Instructions"
Cohesion: 0.40
Nodes (4): CLAUDE.md — read this before touching anything, Commands, Doc map, Hard rules (these exist to stop hallucination)

### Community 22 - "Project Readme & Layout"
Cohesion: 0.40
Nodes (4): Agent Operating Guidelines & Zero-Token Context Strategy, Mandatory Context Rule: Knowledge Graph First, Project Hard Rules, Shriji Domestic Appliances — Sunshine Dealer Web

### Community 23 - "Agent Guidelines (AGENTS.md)"
Cohesion: 0.40
Nodes (4): Documentation, Layout, Shriji Domestic Appliances — Sunshine Dealer Web, Two things to know before you change anything

### Community 24 - "Zoho API Diagnostic Script"
Cohesion: 0.40
Nodes (4): Automatic Codebase Context & Knowledge Graph Protocol, Rule 1: Mandatory Knowledge Graph Lookup (Never Blindly Read Files), Rule 2: Precision File Viewing, Rule 3: Keep Graph Fresh After Modifying Code

### Community 26 - "Vercel Deployment Routing"
Cohesion: 0.50
Nodes (3): Hard Rules, Shriji Dealer Web — Agent Guidelines, Specialized Skills Available

### Community 27 - "Graphify Agent Rules"
Cohesion: 0.50
Nodes (3): Daily Development Commands, Hard Workflow Rules, Shriji Testing & Workflow Skill

## Knowledge Gaps
- **214 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `localCacheFile` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLanguage()` connect `Dealer Auth & Session Management` to `Price Presentation & Product UI`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `ErrorBoundary` connect `Testing & Workflow Skill` to `Dealer Auth & Session Management`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `priceFor()` connect `Price Presentation & Product UI` to `Dealer Auth & Session Management`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dealer Auth & Session Management` be split into smaller, more focused modules?**
  _Cohesion score 0.09562841530054644 - nodes in this community are weakly interconnected._
- **Should `Price Presentation & Product UI` be split into smaller, more focused modules?**
  _Cohesion score 0.08250355618776671 - nodes in this community are weakly interconnected._
- **Should `Zoho Backend & Proxy Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._