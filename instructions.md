# Website & App Redesign Instructions

> **Operational Directive**: Whenever any redesign, UI update, page revamp, or component enhancement is requested for this project, you **MUST** simultaneously consult and synthesize both the **`refero-design`** skill and the **`swiftui-pro`** skill.

---

## 1. Core Purpose & Architectural Goals

The goal of this project is to maintain a unified, high-performance web and mobile application (React 19 + Vite with Capacitor for iOS & Android) that looks and behaves like an elite, custom-engineered product on every screen:
- **Desktop Web (Windows / macOS / Web)**: High information density, expansive multi-column layouts, refined typography, elegant hover states, and fast keyboard/mouse workflows.
- **Mobile Apps & Responsive Web (iOS / Android / Mobile Browsers)**: Fluid, gesture-friendly, thumb-zone optimized interfaces adhering to Apple Human Interface Guidelines (HIG) and modern mobile standards.

When a UI element designed for desktop does not fit or feels suboptimal on mobile, **do not force an awkward shrink-to-fit**. Adapt the UX pattern to match the mobile platform's ergonomics while preserving brand identity and aesthetic consistency.

---

## 2. Tri-Skill Synthesis Engine

For any redesign task, combine the complementary strengths of these three skills:

```
┌─────────────────────────────────────────────────────────────┐
│                      REDESIGN REQUEST                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  refero-design  │   │  apple-design   │   │   swiftui-pro   │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│• Visual hierarchy│  │• 123 HIG pages  │   │• Mobile ergono- │
│• Typography scale│  │• Materials/Glass│   │  mics & layout  │
│• Curated palette│   │• Modality/Sheets│   │• Touch targets  │
│• Elevation/depth│   │• Navigation &   │   │  (≥44pt/48px)   │
│• Anti-AI-slop   │   │  haptics/motion │   │• Safe insets    │
│• Copy & CTAs    │   │• Design audits  │   │• Swift/React UX │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
               ┌─────────────────────────────┐
               │     SYNTHESIZED UI / UX     │
               │   Adaptive across desktop   │
               │   web, iOS & Android apps   │
               └─────────────────────────────┘
```

### Skill 1: `refero-design` (Website & Aesthetic Authority)
Consult `.agents/skills/refero-design/SKILL.md` and its reference files:
- **`references/color.md`**: Strict semantic roles, high contrast, intentional accent usage.
- **`references/typography.md`**: Proportional type scales, optical sizing, tracking, and leading.
- **`references/craft-details.md`**: Micro-interactions, border radiuses, surface elevations, subtle borders, and depth.
- **`references/anti-ai-slop.md`**: Prevent generic cookie-cutter layouts, avoid plain centered boxes, and ensure distinctive character.
- **`references/copywriting.md`**: Concise, scannable labels, strong CTAs, and clear hierarchy.

### Skill 2: `apple-design` (HIG Standards & Design Audit Authority)
Consult `.agents/skills/apple-design/SKILL.md` and its reference files:
- **`references/hig-lookup.md`**: Master routing table across 123 official Apple HIG topics.
- **`references/hig/materials.md`** & **`liquid-glass.md`**: Translucent materials, blur effects, surface layers, and depth.
- **`references/hig/modality.md`** & **`sheets.md`**: Bottom sheets, modal presentation, dismiss gestures, and clear actions.
- **`references/hig/layout.md`**: Safe areas, margin guides, device orientations, and responsive layouts.
- **`references/cross-platform.md`**: Translating HIG principles seamlessly to web, Capacitor, React, and mobile wrappers.

### Skill 3: `swiftui-pro` (Mobile App Ergonomics & View Performance Authority)
Consult `.agents/skills/swiftui-pro/SKILL.md` and its reference files:
- **`references/design.md`**: Touch targets (minimum 44×44pt / 48×48px), finger reachability, clean grouping, and contrast.
- **`references/resizability.md`**: Adaptive layout across varying screen widths, split views, and folding devices.
- **`references/navigation.md`**: Intuitive drill-down navigation, clear back actions, and modal vs. push hierarchy.
- **`references/accessibility.md`**: Dynamic font scaling support, screen reader readability, and high contrast.
- **`references/performance.md`**: Zero layout shift, fluid 60fps animations, lightweight DOM tree, and instant responses.

---

## 3. Adaptive Platform UX Strategies

When a component renders differently or fails to provide an optimal experience on mobile compared to desktop, adapt the UI/UX pattern as follows:

| Desktop Web Pattern | Problem on Mobile | Mobile App Adaptive Solution |
| :--- | :--- | :--- |
| **Multi-Column Data Tables** | Horizontal scroll, unreadable truncated columns | **Expandable Card List**: Stacked cards showing primary info (Title, SKU, Price) with tap-to-expand details. |
| **Sticky Sidebar Filters** | Consumes full viewport width, pushes products down | **Slide-Up Bottom Sheet / Modal Drawer**: Clean filter button with active filter badge chips. |
| **Dense Top Navigation Bar** | Items wrap, buttons overlap on narrow screens | **Bottom Navigation Bar & Drawer**: Thumb-friendly bottom bar for primary sections + hamburger sheet for secondary links. |
| **Hover Tooltips / Popovers** | Hover does not exist on touch devices | **Contextual Inline Badges or Bottom Alert Sheets**: Dedicated tap triggers with clear close dismissals. |
| **Multi-Step Horizontal Forms** | Wizard steps get squished or clipped | **Vertical Accordion / Step-by-Step Drilldown**: Single-focus screens with progress indicator. |
| **Hover-Triggered Actions** | User cannot discover secondary actions | **Swipe Gestures / Persistent Action Buttons**: Action sheets, swipe-to-reveal, or explicit tap buttons. |

---

## 4. Mobile Responsiveness & Layout Hard Rules

To maintain seamless performance on Capacitor (iOS & Android) and mobile browsers:

1. **Zero Viewport Zoom-Out**:
   - Always enforce `overflow-x: clip;` (or `overflow-x: hidden;`) on root containers.
   - Always set `min-width: 0;` on flex and grid children to prevent text or table blowout.
2. **Safe Area Insets**:
   - Accommodate iPhone notches, Dynamic Island, and Android status bars:
     ```css
     padding-top: max(16px, env(safe-area-inset-top));
     padding-bottom: max(16px, env(safe-area-inset-bottom));
     padding-left: max(16px, env(safe-area-inset-left));
     padding-right: max(16px, env(safe-area-inset-right));
     ```
3. **Viewport Height Units**:
   - Use `100dvh` instead of `100vh` to avoid mobile browser address bar jumps.
4. **Touch Target Sizing**:
   - All interactive elements (buttons, inputs, icons, links) must have at least `44px × 44px` clickable area.

---

## 5. Domain Rules for Shriji Dealer Web

Every redesign must preserve these core business requirements:
1. **Live Catalogue & Real Prices**: Fetch from live Zoho Commerce API (`label_rate > rate > min_rate`). Never use synthetic or mock prices.
2. **Zero-Price Items**: If a price is `0` or missing, display **"Price on Request"** (never ₹0).
3. **Role Gating**:
   - Retail Customers only see MRP.
   - Wholesale Dealer rates are masked behind "View Dealer Price" (requires verified dealer login).
   - Any link containing `?from=` forces customer view for all viewers.
4. **Sync Everything**:
   - After altering components, styles, or routes, always execute:
     ```bash
     npm run sync
     ```
     This rebuilds the production bundle, synchronizes native `android/` and `ios/` Capacitor folders, updates `CODEBASE.md`, and refreshes the knowledge graph.

---

## 6. Execution Flow for Redesign Tasks

When the user asks to redesign a screen, component, or flow:

1. **Examine the Design Triad First**:
   - Check `refero-design` for styling, palette, font hierarchy, and polish.
   - Check `apple-design` for 123 HIG pages, materials (liquid glass), modality, and cross-platform UX.
   - Check `swiftui-pro` for mobile ergonomics, touch target sizing, and responsive view performance.
2. **Identify Desktop vs. Mobile Divergence**:
   - Design the responsive layout for both desktop and mobile viewports before coding.
   - Determine which components need adaptive mobile variants (e.g., table → cards, popover → sheet).
3. **Implement with Precision**:
   - Update CSS / JSX with responsive breakpoints (`@media (min-width: 768px)`, etc.).
   - Ensure touch states (`:active`), hover states (`@media (hover: hover)`), and safe areas are handled.
4. **Validate**:
   - Test across viewports (375px mobile, 768px tablet, 1280px+ desktop).
   - Ensure zero horizontal scroll and zero price leakage.
5. **Run Sync**:
   - Run `npm run sync` to propagate changes across web, iOS, Android, and docs.
