# Graph Report - .  (2026-09-28)

## Corpus Check
- 62 files · ~56,751 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1411 nodes · 3869 edges · 85 communities (77 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 70|Community 70]]

## God Nodes (most connected - your core abstractions)
1. `_()` - 444 edges
2. `_()` - 444 edges
3. `i()` - 64 edges
4. `i()` - 64 edges
5. `fl()` - 34 edges
6. `fl()` - 34 edges
7. `useLanguage()` - 28 edges
8. `D()` - 27 edges
9. `vl()` - 27 edges
10. `D()` - 27 edges

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

## Communities (85 total, 8 thin omitted)

### Community 0 - "Dealer Auth & Session Management"
Cohesion: 0.05
Nodes (92): HeroSlider(), STORE_BANNERS, MobileBottomNav(), CustomerPrice(), DealerPrice(), PriceBlock(), ProductCard(), UnderMaintenance() (+84 more)

### Community 1 - "Price Presentation & Product UI"
Cohesion: 0.06
Nodes (63): a(), ac(), ai(), c(), cc(), co(), componentDidCatch(), cs() (+55 more)

### Community 2 - "Zoho Backend & Proxy Endpoints"
Cohesion: 0.08
Nodes (54): am(), an(), b(), bm(), Bp(), cm(), cn(), dn() (+46 more)

### Community 3 - "Dependencies & Package Config"
Cohesion: 0.08
Nodes (48): am(), an(), b(), Bp(), cm(), cn(), dn(), E() (+40 more)

### Community 4 - "Product Pages Specification"
Cohesion: 0.08
Nodes (40): handler(), cachedPricebooks, clearDiskCache(), createDealerContact(), fetchZohoCategories(), fetchZohoPricebookItems(), fetchZohoPricebooks(), fetchZohoProductById() (+32 more)

### Community 5 - "Master Codebase Architecture Reference"
Cohesion: 0.07
Nodes (52): a(), ac(), ai(), bs(), c(), co(), componentDidCatch(), cs() (+44 more)

### Community 6 - "Design System & UI Tokens"
Cohesion: 0.07
Nodes (52): al(), as(), ba(), bc(), Bo(), dl(), dm(), Do() (+44 more)

### Community 7 - "Product Requirements Documentation"
Cohesion: 0.07
Nodes (52): Au(), be(), bm(), Bu(), cl(), Cp(), Cu(), Du() (+44 more)

### Community 8 - "Pricing Regression Test Suite"
Cohesion: 0.07
Nodes (51): al(), as(), ba(), bc(), Bo(), dl(), dm(), Do() (+43 more)

### Community 9 - "Zoho Integration Architecture"
Cohesion: 0.10
Nodes (47): ae(), af(), At(), bt(), ce(), cf(), ch(), D() (+39 more)

### Community 10 - "Client Products Data Store"
Cohesion: 0.09
Nodes (46): ae(), af(), At(), bt(), ce(), cf(), ch(), D() (+38 more)

### Community 11 - "Product Brand & Business Vision"
Cohesion: 0.08
Nodes (45): Au(), Bu(), cl(), Cu(), Du(), eu(), Fu(), gm() (+37 more)

### Community 12 - "Live Pricing Audit Tool"
Cohesion: 0.09
Nodes (43): Bd(), bl(), ca(), da(), ef(), ep(), fa(), Fd() (+35 more)

### Community 13 - "Architecture Doc Generator"
Cohesion: 0.07
Nodes (42): bh(), cc(), delete(), dh(), Di(), ec(), _f(), fh() (+34 more)

### Community 14 - "Roles & Customer Sharing Spec"
Cohesion: 0.06
Nodes (14): _(), addListener(), addWindowListener(), bn(), clearAllCookies(), clearCookies(), jn(), ln() (+6 more)

### Community 15 - "Pricing Hierarchy & Zero-Leakage Spec"
Cohesion: 0.06
Nodes (14): _(), addListener(), addWindowListener(), bn(), clearAllCookies(), clearCookies(), jn(), ln() (+6 more)

### Community 16 - "Graphify Knowledge Graph Skill"
Cohesion: 0.12
Nodes (33): Bd(), bl(), ca(), da(), ef(), ep(), fa(), Fd() (+25 more)

### Community 17 - "Pricing & Roles Skill"
Cohesion: 0.06
Nodes (31): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, react, react-dom, react-router-dom (+23 more)

### Community 18 - "Mobile Responsive UI Skill"
Cohesion: 0.10
Nodes (31): bh(), bs(), delete(), dh(), Di(), _f(), fh(), gf() (+23 more)

### Community 19 - "Oxlint Linter Configuration"
Cohesion: 0.09
Nodes (20): Any, AppDelegate, SceneDelegate, Bool, Capacitor, UIScene, UISceneSession, UIWindow (+12 more)

### Community 20 - "Zoho Integration Skill"
Cohesion: 0.09
Nodes (21): 1. System Overview, 2.1 The Two Audiences (Zero Leakage Rule), 2.2 Pricing Resolution Engine (`api/zoho.js` & `src/data/dealer.js`), 2.3 Guest Access Control & Portal Gating (`src/data/portalGate.js`), 2.4 Shareable Product Link & Zero-Leakage Experience (`src/pages/Product.jsx`), 2.5 Navigation & Bottom Bar Dynamic Filtering, 2. Core Pricing & Identity Architecture, 3. Application Routes & Navigation (+13 more)

### Community 21 - "Claude Agent Instructions"
Cohesion: 0.10
Nodes (19): 1. Price visibility — the rule everything else follows, 2. The pricing module — `src/data/dealer.js`, 3. `<PriceBlock>` — `src/components/PriceBlock.jsx`, 4. Product listing — `/products`, `src/pages/Products.jsx`, 5. Product card — `src/components/ProductCard.jsx`, 6. Product detail — `/products/:id`, `src/pages/Product.jsx`, 7. What is deliberately not here, 8. Files touched on 2026-09-20 (+11 more)

### Community 22 - "Project Readme & Layout"
Cohesion: 0.11
Nodes (17): 1. The direction in one paragraph, 2. Tokens, 3. Layout primitives, 4. Components already built — reuse these, 5. Icons, 6. Responsive rules, 7. Motion and accessibility, Actions (+9 more)

### Community 23 - "Agent Guidelines (AGENTS.md)"
Cohesion: 0.11
Nodes (17): 10. Conventions worth knowing, 1. What this is, 2. Who uses it, 3. Scope, 4. Stack, 5. The pricing model — the core business rule, 6. Data, 7. Evidence ledger — what is verified vs. what is sample (+9 more)

### Community 24 - "Zoho API Diagnostic Script"
Cohesion: 0.12
Nodes (16): crystal, crystalDealer, crystalGuest, genericDealer, genericGuest, genericItem, kettle, kettleDealer (+8 more)

### Community 25 - "Testing & Workflow Skill"
Cohesion: 0.12
Nodes (16): 1. Active Integration Summary, 2. The Code Seams, 3.1 Organization ID — from the Commerce dashboard, 3.2 Client ID + Client Secret — from the API console, not the store, 3.3 Refresh Token — generated once, then permanent, 3.4 Scopes, 3.5 Data centre, 3.6 The API call the keys unlock (+8 more)

### Community 26 - "Vercel Deployment Routing"
Cohesion: 0.18
Nodes (15): br(), Cr(), ei(), Gr(), hp(), In(), kf(), kr() (+7 more)

### Community 27 - "Graphify Agent Rules"
Cohesion: 0.15
Nodes (12): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+4 more)

### Community 28 - "Graphify Workflow"
Cohesion: 0.36
Nodes (11): Bi(), Ci(), Ii(), Li(), lo(), Lr(), Mi(), Ni() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.36
Nodes (11): Bi(), Ci(), Ii(), Li(), lo(), Lr(), Mi(), Ni() (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (11): Dr(), Er(), Fr(), gi(), ir(), patch(), post(), Pr() (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.18
Nodes (9): allFiles, apiFiles, components, dataStores, pages, pkg, rootDir, routes (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (10): Cr(), ei(), Gr(), kr(), patch(), post(), put(), request() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.20
Nodes (9): 1. The four viewers, 2. The rule, in one function, 3. ⚠️ What this is not, 4. The share link, 5. What the customer sees — `CustomerPrice` in `PriceBlock.jsx`, 6. The login flow, 7. Also gated, 8. Checks (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.28
Nodes (9): br(), hp(), In(), kf(), of(), qf(), Sr(), Tr() (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (8): 1. Source of Truth: Live Zoho Commerce Store API, 2.1 Customer View, 2.2 Dealer View, 2.3 Share Link Invariant, 2. Customer vs. Dealer Price Resolution (`src/data/dealer.js`), 3. Automated Pricing Regression Protection, PRICING-ARCHITECTURE.md — Pricing Engine & Audit Specification, Rate Priority Hierarchy

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (8): 1. Query the Graph (Context-Efficient), 2. Trace Relationships (Shortest Path), 3. Explain a Node or Symbol, 4. Update the Graph (AST Re-Extraction), Graphify Knowledge Graph Skill, Key Output Artifacts in `graphify-out/`, Primary Commands, Why Use Graphify

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (9): ah(), ap(), eh(), Id(), nf(), nh(), op(), rh() (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (8): 1. Guest View (Public), 2. Dealer View (Authenticated), 3. Customer Shared View (`?from=<dealer_id>`), Key Files, Schemes Logic, Shriji Pricing & Roles Skill, User Roles & View Modes, Zero-Price Handling

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (8): 1. Viewport Zoom-Out Prevention, 2. CSS Grid Child Shrinking, 3. Product Card Rows on Mobile (`<= 719px`), 4. Horizontal Scrollable Tabs (`.utabs`, `.tabs`), 5. Hero Banner on Small Screens (`<= 640px`), Critical Mobile Responsiveness Safeguards, Design System Tokens, Shriji Responsive UI Skill

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (8): ct(), ee(), Md(), Qe(), tt(), xs(), ze(), zs()

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (8): ct(), ee(), Md(), Qe(), tt(), xs(), ze(), zs()

### Community 42 - "Community 42"
Cohesion: 0.25
Nodes (8): fe(), He(), le(), p(), Pe(), ue(), we(), Xd()

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (7): Dr(), Er(), Fr(), gi(), ir(), Pr(), qn()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (6): Ar(), nr(), rr(), vi(), Vr(), zr()

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (6): Ar(), nr(), rr(), vi(), Vr(), zr()

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 47 - "Community 47"
Cohesion: 0.33
Nodes (5): API Endpoints Reference, Key Files & Architecture, Pricing & Rate Priority, Shriji Zoho Integration Skill, Validation & Audit Commands

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (5): hide(), setAnimation(), setStyle(), show(), unavailable()

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): CLAUDE.md — read this before touching anything, Commands, Doc map, Hard rules (these exist to stop hallucination)

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (4): Agent Operating Guidelines & Zero-Token Context Strategy, Mandatory Context Rule: Knowledge Graph First, Project Hard Rules, Shriji Domestic Appliances — Sunshine Dealer Web

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (5): hide(), setAnimation(), setStyle(), show(), unavailable()

### Community 52 - "Community 52"
Cohesion: 0.40
Nodes (4): Documentation, Layout, Shriji Domestic Appliances — Sunshine Dealer Web, Two things to know before you change anything

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (4): Automatic Codebase Context & Knowledge Graph Protocol, Rule 1: Mandatory Knowledge Graph Lookup (Never Blindly Read Files), Rule 2: Precision File Viewing, Rule 3: Keep Graph Fresh After Modifying Code

### Community 54 - "Community 54"
Cohesion: 0.50
Nodes (3): Hard Rules, Shriji Dealer Web — Agent Guidelines, Specialized Skills Available

### Community 56 - "Community 56"
Cohesion: 0.50
Nodes (4): ah(), ap(), eh(), op()

### Community 57 - "Community 57"
Cohesion: 0.50
Nodes (4): fe(), le(), Pe(), ue()

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (4): be(), Cp(), _m(), xe()

### Community 61 - "Community 61"
Cohesion: 0.50
Nodes (3): Daily Development Commands, Hard Workflow Rules, Shriji Testing & Workflow Skill

### Community 62 - "Community 62"
Cohesion: 0.50
Nodes (3): framework, headers, rewrites

### Community 63 - "Community 63"
Cohesion: 0.67
Nodes (3): removeAllListeners(), removeListener(), removeWindowListener()

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (3): removeAllListeners(), removeListener(), removeWindowListener()

## Knowledge Gaps
- **247 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `localCacheFile` (+242 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_()` connect `Roles & Customer Sharing Spec` to `Community 32`, `Community 34`, `Dependencies & Package Config`, `Master Codebase Architecture Reference`, `Design System & UI Tokens`, `Product Requirements Documentation`, `Community 40`, `Zoho Integration Architecture`, `Community 43`, `Community 44`, `Live Pricing Audit Tool`, `Architecture Doc Generator`, `Community 48`, `Community 56`, `Community 57`, `Graphify Workflow`, `Community 63`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `_()` connect `Pricing Hierarchy & Zero-Leakage Spec` to `Price Presentation & Product UI`, `Zoho Backend & Proxy Endpoints`, `Community 65`, `Community 37`, `Pricing Regression Test Suite`, `Community 41`, `Client Products Data Store`, `Product Brand & Business Vision`, `Community 42`, `Community 45`, `Graphify Knowledge Graph Skill`, `Mobile Responsive UI Skill`, `Community 51`, `Vercel Deployment Routing`, `Community 59`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `i()` connect `Master Codebase Architecture Reference` to `Community 32`, `Dependencies & Package Config`, `Design System & UI Tokens`, `Product Requirements Documentation`, `Zoho Integration Architecture`, `Live Pricing Audit Tool`, `Architecture Doc Generator`, `Roles & Customer Sharing Spec`, `Graphify Workflow`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _247 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dealer Auth & Session Management` be split into smaller, more focused modules?**
  _Cohesion score 0.05199350081239845 - nodes in this community are weakly interconnected._
- **Should `Price Presentation & Product UI` be split into smaller, more focused modules?**
  _Cohesion score 0.060515873015873016 - nodes in this community are weakly interconnected._
- **Should `Zoho Backend & Proxy Endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.0750925436277102 - nodes in this community are weakly interconnected._