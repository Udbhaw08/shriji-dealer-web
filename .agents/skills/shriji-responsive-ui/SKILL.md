---
name: shriji-responsive-ui
description: >-
  Use this skill when modifying UI components, layout, styling in src/styles.css,
  or fixing mobile responsiveness, alignment, and viewport zoom-out issues.
---

# Shriji Responsive UI Skill

This skill defines the design tokens, mobile-first responsiveness safeguards, and layout standards for the Shriji Dealer Web platform.

## Design System Tokens
- **Background Ground**: `--bg: #eceff4` (light blue-grey)
- **Primary Brand / Action**: `--navy: #0e2438`, `--navy-2: #16324c`
- **Soft Blue Accents**: `--blue-50: #f0f5fc`, `--blue-100: #e3edfa`, `--blue-ink: #1d4e7f`
- **Surfaces**: `--card: #ffffff`, `--line: #e7ebf1`, `--line-2: #dfe5ee`
- **Typography**: Plus Jakarta Sans (`font-family: var(--font)`), quiet and tight
- **Border Radii**: `--r-sm: 10px`, `--r: 14px`, `--r-lg: 20px`, `--r-xl: 26px`

## Critical Mobile Responsiveness Safeguards

### 1. Viewport Zoom-Out Prevention
Mobile browsers automatically zoom out the entire page if ANY element exceeds `100vw`.
- `html` and `body` MUST include `overflow-x: clip;` and `min-width: 0;`.
- Never use fixed widths greater than `280px` without `max-width: 100%`.
- Heading classes (`h1`, `h2`, `h3`, `h4`, `.d1`, `.d2`) MUST include `overflow-wrap: break-word;` and `word-break: break-word;`.

### 2. CSS Grid Child Shrinking
In CSS Grid containers (e.g. `.detail`, `.cats`, `.prods`, `.stats`), child elements default to `min-width: auto`.
- Grid containers must declare `minmax(0, 1fr)` tracks.
- Grid children must have `min-width: 0; max-width: 100%;` so child tabs, long titles, or code snippets do not expand grid columns.

### 3. Product Card Rows on Mobile (`<= 719px`)
- On screens `<= 719px`, `.prods` renders as vertical rows with thumbnail on the left (`.prod-link { flex-direction: row; }`).
- The `.heart` save button is positioned absolute `top: var(--s4); right: var(--s3); width: 32px;`.
- `.prod-foot` MUST have `padding: var(--s4) 46px var(--s4) 0;` (at least 44-46px right padding) so title and specs never collide with or underflow the heart icon.

### 4. Horizontal Scrollable Tabs (`.utabs`, `.tabs`)
- Scrollable tab containers must have `max-width: 100%`, `overflow-x: auto;`, `-webkit-overflow-scrolling: touch;`, and `scrollbar-width: none;`.

### 5. Hero Banner on Small Screens (`<= 640px`)
- Action buttons in `.banner .row` stack vertically with `width: 100%` so they never stretch past narrow phone screens.
