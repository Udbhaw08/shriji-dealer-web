# DESIGN.md — the design system as actually built

Derived from `src/styles.css` (~1,800 lines) and the two approved mockups in the repo root.
If you are about to write CSS, read this first: the class you need probably already exists.

**Source of truth for layout:** `web ref.jpeg` and `mobile ref.jpeg` in the project root.
Read the images before redesigning any screen.

---

## 1. The direction in one paragraph

Light blue-grey ground, white cards, deep navy for every primary action, soft blue for icon tiles
and chips. Generous rounding (14–26px). Quiet, tight typography in Plus Jakarta Sans. Nothing
shouts. It should read as a dependable trade tool, not a consumer storefront.

## 2. Tokens

All tokens live on `:root` in `src/styles.css`. **Never hardcode a colour, radius, shadow or gap.**

### Colour

```css
/* ground + surfaces */
--bg: #eceff4;        /* page ground */
--bg-2: #f5f7fa;      /* recessed / gradient top */
--card: #ffffff;
--line: #e7ebf1;      /* default border */
--line-2: #dfe5ee;    /* stronger border */

/* navy — every primary action */
--navy: #0e2438;
--navy-2: #16324c;
--navy-soft: #24455f;

/* soft blue — tiles, chips, highlights */
--blue-50:  #f0f5fc;
--blue-100: #e3edfa;
--blue-200: #cfe1f7;
--blue-300: #b6d3f3;
--blue-ink: #1d4e7f;   /* blue text on light blue */

/* text */
--tx: #0f1d2e;         /* primary */
--tx-2: #5a6b80;       /* secondary */
--tx-3: #8b98a8;       /* tertiary / meta */
--on-navy: #ffffff;
--on-navy-2: #a9bdd2;

/* status */
--ok-bg / --ok-tx / --warn-bg / --warn-tx / --err
```

### Spacing, radius, shadow, motion

```css
--s1 .25rem  --s2 .5rem  --s3 .75rem  --s4 1rem
--s5 1.5rem  --s6 2rem   --s7 3rem    --s8 4.5rem

--r-sm 10px  --r 14px  --r-lg 20px  --r-xl 26px

--sh-sm   /* resting card */
--sh      /* hover / raised */
--sh-lg   /* modal / hero */

--ease: cubic-bezier(0.2, 0.8, 0.25, 1);
--page: 1200px;   /* .wrap max width */
```

### Type

`--font: "Plus Jakarta Sans"`, body `0.975rem / 1.6`.

| Class | Use |
|---|---|
| `.d1` | Page hero heading |
| `.d2` | Page title (`<h1>` on listing, detail, schemes, support) |
| `.h3` | Card / section subheading |
| `.sub` | Lead paragraph under a title |
| `.eyebrow` | Small uppercase label above a heading |
| `.muted` `.small` `.note` | Secondary, small, and fine-print text |

## 3. Layout primitives

| Class | What it does |
|---|---|
| `.wrap` | Centred container, `--page` wide, side gutters |
| `.sec` | Vertical section rhythm |
| `.sec-head` | Section title row with a trailing link or control |
| `.row` | Horizontal flex, wraps |
| `.stack` | Vertical flex |
| `.grid` | Auto-fill responsive grid |
| `.card` / `.pad` | White rounded surface / its inner padding |

## 4. Components already built — reuse these

### Actions
`.btn` with `.btn-navy` (primary), `.btn-white`, `.btn-ghost` (outline), `.btn-sm`, `.btn-block`.
`.icon-btn` for square icon buttons. `.fab` for the small circular chevron affordance.

### Navigation and filtering
`.hdr` `.nav` `.mark` (logo lockup) · `.crumbs` (breadcrumb) · `.tabs` / `.tab` (pill tabs, fill
navy when `aria-selected="true"`) · `.chips` / `.chip` (pill filters, `aria-pressed`) ·
`.catchips` / `.catchip` (thumbnail category chips) · `.search` (input with leading icon) ·
`.toolbar` (sticky filter bar under the header) · `.sortby` (Sort By select).

### Product
`.prods` (responsive card grid, `minmax(214px, 1fr)`) · `.prod` (card) · `.prod-img` ·
`.prod-foot` · `.prod-link` · `.prod-tag` · `.heart` (save toggle) ·
`.dprice` (dealer price reveal — see docs/PRODUCT-PAGES.md).

### Detail
`.detail` (two-column at ≥960px) · `.gallery` / `.gallery-main` / `.thumbs` / `.thumb` / `.dots` ·
`.feats` / `.feat` (icon-over-two-line-label boxes) · `.buybox` · `.scheme-row` · `.overview` ·
`.spec` (spec table) · `.bullets`.

### Listing sidebar
`.listing` (sidebar + results grid) · `.filters` (sidebar on desktop, sheet on mobile) ·
`.fhead` · `.fgroup` (one filter group).

### Content
`.cats` / `.cat` (category tiles) · `.strip` (category banner) · `.banner` (hero) ·
`.list` / `.list-row` · `.scheme` (gradient scheme card) · `.pricerow` · `.mats` / `.mat`
(marketing material tiles) · `.badge` / `.badge-blue` / `.badge-warn` · `.stats` · `.quicknav` /
`.qn` · `.tile` (soft blue icon square) · `.empty` · `.field` / `.form-grid` / `.dropzone` / `.ok`.

## 5. Icons

One line-icon family, defined as SVG paths in `PATHS` inside `src/ui.jsx`. All share a 20×20
viewBox, 1.6 stroke, round caps and joins, `currentColor`.

```jsx
<Icon name="flame" size={20} />
```

Available: `arrow arrowsm chev search filter heart stove chimney hob blender tag sparkle support
doc image download phone mail pin wa share menu close check shield flame glass steel bolt upload plus`

Unknown names silently fall back to `doc`. **Add a path to `PATHS` rather than importing an icon
library** — matching the 1.6-stroke family matters more than the exact glyph.

## 6. Responsive rules

Mobile-first. The important breakpoints:

| Breakpoint | What changes |
|---|---|
| `≤640px` | `.wrap` gutters tighten |
| `≤720px` | `.strip` stacks |
| `≤900px` | Nav collapses to the burger menu |
| `≤1040px` | Header tagline hides |
| `≥960px` | `.detail` becomes two columns; `.listing` gains its sticky filter sidebar and the mobile filter button/sheet disappear |

**The filter pattern is one piece of markup, two presentations** — a sticky sidebar on desktop, a
toggled sheet on mobile, switched entirely in CSS. Do not fork it into two components.

## 7. Motion and accessibility

- Transitions use `--ease`, typically 0.2–0.5s. Cards lift 4px on hover.
- `prefers-reduced-motion: reduce` kills all animation and smooth scroll — already handled globally.
- `:focus-visible` is a 2px navy outline with 2px offset, globally. Do not remove it.
- A skip link (`.skip`) precedes the header.
- Interactive state is carried on real ARIA attributes (`aria-pressed`, `aria-selected`,
  `aria-current`, `aria-expanded`) and styled from them, so the visual state and the announced
  state can never drift apart. Keep doing this.
- Never nest an interactive element inside `.prod-link`. The save button and the dealer-price
  button are siblings of the link, not children, for exactly this reason.
