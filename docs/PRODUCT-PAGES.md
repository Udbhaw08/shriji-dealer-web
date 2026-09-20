# PRODUCT-PAGES.md — listing, detail, and dealer pricing

The product surface is the heart of this app and the focus of the 2026-09-20 session. This doc
specifies what exists, why it is shaped that way, and the rules that must not be broken.

**Mockup reference:** `web ref.jpeg` panels 2, 3, 4 · `mobile ref.jpeg` panels 3, 4, 5.

---

> **Roles, login and share links moved to [ROLES-AND-SHARING.md](ROLES-AND-SHARING.md) on
> 2026-09-20.** This doc covers page structure; that one covers who may see a price. § 1 and § 3
> below are a summary — the other doc wins on any conflict.

## 1. Price visibility — the rule everything else follows

| Viewer | Sees MRP | Sees dealer price | Primary action |
|---|---|---|---|
| **Dealer** (built) | **No — never** | Yes, after pressing View Dealer Price | Share with Customer |
| **Customer** (not built) | Yes | No — never | Contact Dealer / Share on WhatsApp |

Three consequences, all stated by the user on 2026-09-20:

1. **MRP does not appear anywhere in the dealer view.** The original mockup showed "MRP ₹8,999"
   beside "View Dealer Price". It was removed so a dealer cannot read a customer price off their
   own screen mid-conversation. The only place MRP survives is inside the revealed dealer-price
   note, as the basis of the rebate calculation.
2. **"Enquire Now" is gone** from the product detail page. A dealer who can see their price has
   nothing to enquire about. `EnquiryButtons` still exists in `src/ui.jsx` and is used elsewhere;
   it is simply not used on the product detail page any more.
3. **"Share with Customer" is the primary action** on the detail page.

**Dealer pricing appears on the product detail page only.** It was briefly on the listing cards
too; the user removed it on 2026-09-20 — a dealer scrolling a list in front of a customer should
not have prices on screen. A card shows the model, its subtitle and its tag, nothing else.

**The reveal is a toggle.** Once shown, the same button reads "Hide Dealer Price" and puts the
figure away again. Same reasoning: the dealer needs to be able to clear the screen fast.

The price shown is **account-specific**: it belongs to the signed-in dealer, not to the catalogue.
Today that account is the hardcoded `ACCOUNT` in `src/data/dealer.js`; after Zoho it will be the
signed-in dealer's contract price.

## 2. The pricing module — `src/data/dealer.js`

This is the **only** place in the app that knows a rupee figure. Everything else imports from it.
That is deliberate: it is the single seam to replace when Zoho is connected.

```js
export const ACCOUNT = {
  id: "SD-4587", name: "Shah Electronics", person: "Kunal Shah",
  city: "Andheri West, Mumbai", tier: "Verified Dealer", rebatePct: 22,
};

priceFor(product) → { mrp, dealer, rebatePct }
tagFor(product)   → { label: "New" | "Bestseller" | "Premium", kind } | null
inr(8999)         → "₹8,999"
```

**How the sample prices are generated.** A 31-based string hash of the product id is mapped into a
per-category MRP band, then rounded to end in 99. The dealer price is that MRP less the account's
rebate, rounded the same way.

```
gas_stoves        ₹2,490 – ₹12,990
hobs              ₹8,990 – ₹34,990
hob_tops          ₹6,990 – ₹24,990
chimneys          ₹9,990 – ₹44,990
small_appliances  ₹499   – ₹4,990
```

Because it is a pure function of the id, a product shows the same price on every reload and on
every screen — the listing card and the detail page can never disagree. **Do not compute a price
anywhere else, and do not hardcode one in a component.**

`tagFor` derives the Bestseller / New / Premium ribbon from the same hash, plus a price-band test
for Premium. Sample data, same reasoning.

**Self-check:** `node src/data/dealer.test.mjs` asserts, across all 162 products, that prices are
stable across calls, that the dealer price always beats MRP, that it is a positive integer, and
that MRP ends in 99. Run it after touching this module.

## 3. `<PriceBlock>` — `src/components/PriceBlock.jsx`

One component holding both views, used once, on the product detail page:
`<PriceBlock p={product} customerView={…} dealer={…} sharedBy={…} />`. The caller decides the view
with `viewerFor()`; see [ROLES-AND-SHARING.md](ROLES-AND-SHARING.md). The dealer branch:

It renders the `.pricebox`: a two-cell block laid out like the mockup — the price on the left, the
navy action button on the right, stacking on narrow screens.

**Closed** — the left cell shows "Your Dealer Price" over a masked amount and "Hidden until you
ask"; the right cell is a navy **View Dealer Price** button with a padlock, under a "Visible to
verified dealers only" note.

**Open** — the left cell shows the amount and "(Incl. of all taxes)"; the button becomes **Hide
Dealer Price** with a struck-through eye; the note becomes the rebate basis, the MRP it was
computed from, the account it belongs to, and "Customers see only MRP." That note is the only
place MRP ever appears, and only as the basis of the dealer's own discount.

State is local to the component and resets on navigation. That is intentional — a price should not
stay revealed on a screen the dealer has walked away from.

## 4. Product listing — `/products`, `src/pages/Products.jsx`

### Structure

```
Page title + count
Sticky .toolbar          search box · filter button (mobile only) · category thumbnail chips
.listing grid
  ├── aside.filters      Category (desktop) · Brand · Burner Type · Ignition · Finish · "Show N products"
  └── main               breadcrumb · category banner (when filtered) · results header + Sort By · .prods grid · Load more
```

### Responsive behaviour

- **≥960px:** the filter sidebar is a 236px sticky column; the mobile filter button and the
  "Show N products" button are hidden by CSS.
- **<960px:** the sidebar is hidden until the toolbar's filter button sets `data-open`, then it
  renders as a full-width sheet above the results, closed by "Show N products".

One set of markup, two presentations. Do not fork it.

### Filters and facets

- **Category has two presentations, never both at once.** On a phone it is the thumbnail chip row
  in the toolbar, as in the mobile mockup. At ≥960px that row is hidden and category becomes the
  first sidebar checkbox group, as in the web mockup. Category is the only filter held in the
  **URL** (`?cat=gas_stoves`), so category links from the home page and footer work.
- **Brand, Burner Type, Ignition Type, Finish** are sidebar checkbox groups, single-select
  (checking a second option replaces the first). Component state, not URL. Ignition is derived from
  `features.includes("Auto Ignition")`.
- **Price Range** appears in the web mockup and is deliberately not built: the prices are sample
  data, and price is not shown on this page at all. Add it when Zoho supplies real figures.
- **Facet counts recompute against the active category**, so you never see "3 Burner (22)" while
  looking at chimneys.
- Changing category clears burner and finish, because those facets may not exist in the new
  category.
- Any filter change resets pagination to the first 24.

### Sort

`Popularity` (default — the natural module order: category order, photographed models first, then
alphabetical), `Name (A–Z)`, `Price: Low to High`, `Price: High to Low`. Price sorts call
`priceFor()`, so they sort by **dealer** price, not MRP.

### Pagination

24 per page, "Load N more" with a "Showing X of Y" note. No infinite scroll — a dealer on a weak
connection should control when more images load.

## 5. Product card — `src/components/ProductCard.jsx`

```
┌──────────────────────┐
│ [tag]        [♥]     │   tag ribbon top-left, save toggle top-right
│      product image   │
├──────────────────────┤
│ Model name           │
│ size · feature · cat │
└──────────────────────┘
```

Props: `p` (product). **No price on a card** — see § 1.

**On a phone the card becomes a row** (image left, text right, full width), matching the mobile
mockup's listing. That is a CSS-only switch at ≤719px; there is one component, not two.

**The save button is a sibling of the `<Link>`, not a child.** Nesting a button inside a link
breaks keyboard and screen-reader behaviour. Keep it outside.

Products without a photo (`img: null`) render a soft-blue icon tile chosen from the category.

## 6. Product detail — `/products/:id`, `src/pages/Product.jsx`

### Left column

- **Gallery** — tag ribbon, main image, dot indicators, thumbnail strip. Sibling shots from the same category
  fill the strip, since the scrape gave one photo per product. This is a visual placeholder for the
  real multi-image set Zoho will provide.
### Below the whole grid

- **"More in {category}"** — up to four related product cards. It sits *outside* `.detail`, not in
  the gallery column. When the grid collapses to one column on a phone it would otherwise land
  between the gallery and the product information, which is exactly the bug the user reported on
  2026-09-20. Do not move it back inside.

### Right column

1. Model name (the tag ribbon sits on the gallery image instead)
2. Subtitle: size · lead feature · category
3. **`.feats`** — up to four icon-over-label boxes derived from the product's real attributes
   (burner count, auto ignition, toughened glass, stainless body, BLDC motor, spill proof, flame
   failure device), always ending with Sunshine Warranty
4. **`.pricebox`** (dealer) or **`.custbox`** (customer) — `<PriceBlock>`, laid out as in the mockup
5. **`.actions`** — **Share with Customer** and **Current Scheme · 5 + 1**, side by side
6. **`.utabs`** — underline tabs, as in the mockup, not the pill `.tabs` used elsewhere

### Tabs

| Tab | Contents |
|---|---|
| Overview | "Engineered for Everyday Excellence" plus a sentence generated from the product's finish and features |
| Specifications | The `.spec` table: model, full catalogue name, category, size, finish, brand, features, product code |
| In The Box | Derived from category — unit, manual, warranty card, plus pan supports and burner caps for stoves, mounting kit and duct pipe for chimneys, cut-out template and fixing clamps for hobs |

**Marketing Material** and **Videos** exist as tabs, each with an honest empty state ("No videos
uploaded for the Thar 3B yet") and a link through to `/support#marketing`. There are no per-product
assets yet; wire them when Zoho supplies them.

### Share with Customer

Uses the Web Share API with a fallback to clipboard. The shared text is deliberately price-free:

> `{model} — {category} from Sunshine. Ask me for today's price.`

A shared link must never carry the dealer price.

## 7. What is deliberately not here

- **Star ratings and review counts.** In the mockup ("4.8, 240 Reviews"), left out on purpose — a
  fabricated review score on a real company's site is a fake, not a placeholder. Do not add them
  without the user asking.
- **Compare, stock levels, order quantity, add to order.** Not requested.

## 8. Files touched on 2026-09-20

| File | Change |
|---|---|
| `src/data/dealer.js` | **New.** Account, price generator, tag generator, currency formatter |
| `src/data/dealer.test.mjs` | **New.** Assert-based self-check over all 162 products |
| `src/components/PriceBlock.jsx` | **New.** Dealer reveal-toggle and customer MRP views |
| `src/components/ProductCard.jsx` | Tag ribbon, price row, link restructured so buttons are not nested inside it |
| `src/pages/Products.jsx` | Sidebar/sheet filters, brand + burner + finish facets, sort control, category banner moved into the results column |
| `src/pages/Product.jsx` | MRP removed, Enquire Now removed, dealer-price buybox, scheme row, Share with Customer, three-tab panel |
| `src/styles.css` | `.listing`, `.filters`, `.fgroup`, `.sortby`, `.pricebox`, `.actions`, `.utabs`, `.prod-tag`, `.prod-link`, phone row-cards, category show/hide |
| `src/ui.jsx` | Added the `lock` and `eyeoff` icons; header account control |
| `src/data/session.js`, `src/pages/Login.jsx`, `src/components/PriceBlock.jsx` | **New** — roles, login and the customer view. See [ROLES-AND-SHARING.md](ROLES-AND-SHARING.md) |

Verified: `npm run build` succeeds, `npm run lint` adds no new warnings, `node
src/data/dealer.test.mjs` passes. **Not yet verified in a browser** — the visual review of these
pages is the next thing the user should do.
