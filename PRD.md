# PRD — Shriji Domestic Appliances Dealer Web

**Status:** first draft / pitch build, in active development
**Last updated:** 2026-09-20
**Audience:** the developer and any AI agent picking this project up cold
**Companion docs:** [CLAUDE.md](CLAUDE.md) · [docs/DESIGN.md](docs/DESIGN.md) · [docs/PRODUCT-PAGES.md](docs/PRODUCT-PAGES.md) · [docs/ROLES-AND-SHARING.md](docs/ROLES-AND-SHARING.md) · [docs/ZOHO-INTEGRATION.md](docs/ZOHO-INTEGRATION.md)

---

## 1. What this is

A dealer-facing website / web app for **Shriji Domestic Appliances Pvt. Ltd.**, a Mumbai
distributor of domestic kitchen appliances carrying the **Sunshine India** brand (founded 1999).

It is not a shop. There is no cart and no checkout. The unit of conversion is a **conversation** —
a dealer finds a model, sees their own price, and either shares it with a walk-in customer or calls
the distributor.

The current artefact is a **first draft built to be shown**, not a production system. It runs
entirely from local data with `npm run dev` and no backend.

## 2. Who uses it

| Audience | Phase | What they need |
|---|---|---|
| **Dealers / retailers** (primary) | now | The range, their own price, active schemes, price lists, marketing material, service requests, a fast line to the distributor |
| **Prospective dealers** | now | Enough credibility to submit a dealership enquiry |
| **End customers** | later | A consumer view that shows MRP only, never dealer pricing |
| **Owner / employee roles** | later | Role-split access (see mockup panel 9, "Switch View V1") |

**Operating reality that drives every layout decision:** dealers browse on a phone, standing in
their shop, mid-conversation with a customer, often on a weak connection. They search by model name
and burner count (`3B Carnival Plus Auto`, `60 Dijon BLDC CH`), not by marketing copy. WhatsApp is a
primary channel.

## 3. Scope

### Built and working

| Area | Route | File | State |
|---|---|---|---|
| Home | `/` | `src/pages/Home.jsx` | Draft complete — hero, category grid, featured products, quick access, stats |
| Product listing | `/products` | `src/pages/Products.jsx` | **Reworked 2026-09-20** — see docs/PRODUCT-PAGES.md |
| Product detail | `/products/:id` | `src/pages/Product.jsx` | **Reworked 2026-09-20** — see docs/PRODUCT-PAGES.md |
| Schemes | `/schemes` | `src/pages/Schemes.jsx` | Draft — active / upcoming / past tabs, dealer price lists section (`#pricing`) |
| Support | `/support` | `src/pages/Support.jsx` | Draft — raise a service request, marketing material (`#marketing`), become-a-dealer form (`#apply`) |
| Sign in / apply | `/login` | `src/pages/Login.jsx` | **New 2026-09-20** — dealer sign-in, customer sign-in, dealer application, pending-approval state |
| Shell | all | `src/ui.jsx` | Header (session-aware account control), footer, icon set |

### Not built yet (and deliberately so)

- **Real authentication.** `/login` implements the full flow — guest, customer, pending dealer,
  approved dealer — but the session is a `localStorage` flag with no password and no server. It is
  a demo of the flow, not security. See [docs/ROLES-AND-SHARING.md](docs/ROLES-AND-SHARING.md) § 3.
- **Backend.** No API calls anywhere. All data is local JS modules.
- **Role switching**, my orders, saved products, profile, notifications, price-list PDFs,
  ticket history. All present in the mockups, none implemented.
- **New Launches** as its own page — the nav item points at `/products?sort=new`, which the
  listing page does not yet read.

## 4. Stack

```
React 19 + Vite 8 + react-router-dom 7
Plain CSS with custom properties (src/styles.css) — no Tailwind, no CSS framework, no UI library
oxlint for linting
```

Chosen by the user to keep the build light so the draft runs with one command. **Do not add
dependencies.** Fonts: Plus Jakarta Sans via Google Fonts, loaded in `index.html`.

Images: 100+ real product photos downloaded from the incumbent Zoho CDN into `public/img/` as
`.webp`, so the draft works offline.

## 5. The pricing model — the core business rule

This is the single most important behaviour in the product, and the thing most likely to be got
wrong by someone reading only the mockups.

- Every product has an **MRP** (what a customer pays) and a **dealer price** (MRP minus that
  account's rebate — currently 22%).
- **A dealer must never see MRP on screen.** It was on the original mockup; the user removed it in
  the 2026-09-20 session precisely so a dealer cannot accidentally read a customer price aloud.
- **Nobody but an approved dealer may see a dealer price.** Guests, customers and dealers whose
  application is still pending all see MRP.
- The dealer price is **hidden behind a button** (View Dealer Price / Hide Dealer Price). It is
  account-specific, and it appears on the product detail page only — never on a listing card.
- **"Enquire Now" was removed** from the product detail page. The dealer already has a price; they
  do not need to enquire. The remaining action is **"Share with Customer"**.
- **The customer view** shows MRP, names the dealer who shared the link ("Available with Shah
  Electronics"), and offers Contact Dealer / Share on WhatsApp. It has no dealer-price control at
  all — not disabled, not hidden: not rendered.
- **A shared link is a customer link for everyone**, including the dealer who generated it. A
  dealer shares `/products/<id>?from=<dealerId>`; that parameter forces the customer view.

Full behavioural spec: [docs/ROLES-AND-SHARING.md](docs/ROLES-AND-SHARING.md). Page-level detail:
[docs/PRODUCT-PAGES.md](docs/PRODUCT-PAGES.md).

## 6. Data

| Module | Contents | Truth level |
|---|---|---|
| `src/data/products.js` | 162 products + 5 categories | **Real** — scraped from shrijidomestic.com on 2026-09-18 |
| `src/data/site.js` | Company facts, nav, stats | **Real** company facts; schemes and marketing counts are sample |
| `src/data/dealer.js` | Dealer directory, price generator, product tags, the viewer rules | **Entirely sample.** Deterministic from product id |
| `src/data/session.js` | Who is signed in, and at what role | Demo only — a localStorage flag |

### Product record shape

```js
{
  id: "3334672000000841676",        // Zoho item id — real, and the join key for the API
  name: "60 Anton Plus Max BLDC CH Sunshine",   // full catalogue name
  model: "Anton Plus Max",          // what a dealer actually says out loud
  size: "60 cm",                    // or null
  burners: 3,                       // or null
  finish: "Black Glass",
  fkey: "glass",                    // finish key: glass | steel | alloy | matte | blue …
  features: ["Auto Ignition", "BLDC Motor"],
  brand: "Sunshine",                // or "KuchenBau"
  cat: "gas_stoves",                // category key
  catLabel: "Gas Stoves",
  code: "GS",
  img: "royal4bj-webp-af0363.webp"  // file in public/img/, or null
}
```

Products are pre-sorted at module load: category order first (`gas_stoves, hobs, hob_tops,
chimneys, small_appliances`), photographed models before unphotographed, then alphabetical. That
order **is** the "Popularity" sort in the UI.

### ⚠️ Known discrepancy

`PRODUCT.md` says **six** categories including *Gas Geysers*. The scraped data contains **five** —
there are no gas geyser products in `src/data/products.js`. The code is correct; the prose in
PRODUCT.md is stale. Do not add a geyser category with invented products to "fix" this.

## 7. Evidence ledger — what is verified vs. what is sample

Check this table before you state anything about this business as fact.

### Verified (scraped from shrijidomestic.com, 2026-09-18)

- Legal name: Shriji Domestic Appliances Pvt. Ltd. · Brand: Sunshine (Sunshine India) · Founded 1999
- Phone `+91 77383 69367` · Email `hello@restor.in` · Motilal Nagar 1, Goregaon West, Mumbai
- Stats: 25+ years · 1,000+ retailers · 4,500+ customers served monthly · 4,000+ products installed monthly
- 162 product names, categories, finishes, burner counts and photographs
- Incumbent site runs on Zoho Commerce; images served from `cdn2.zohoecommerce.com`
- Taglines from the approved mockup: "Better Products, Stronger Partners, Brighter Homes" and
  "Engineered for a Better Tomorrow"

### Sample / invented for the draft — must stay labelled as such

- **All prices.** MRP, dealer price, the 22% rebate, scheme values
- The dealer account: Kunal Shah / Shah Electronics / SD-4587 / Andheri West
- Product tags: Bestseller / New / Premium
- All schemes in `src/data/site.js` including "Coolest Summer Offer" and the "5 + 1" badge
- Marketing material asset counts, service ticket data
- **Deliberately absent:** star ratings and review counts. They appear in the mockup ("4.8, 240
  Reviews") but were left out of the build — a fabricated review score on a real company's site is
  a different class of lie from a placeholder price. Do not add them without the user asking.

## 8. Roadmap

**Now (current focus):** product listing and product detail, web and mobile — done in the
2026-09-20 session, pending the user's visual review.

**Next, in the order the user is likely to want it:**

1. **Zoho Commerce integration** — the user has full admin access to the Zoho store and has offered
   to supply credentials. Replace sample prices with real ones. See
   [docs/ZOHO-INTEGRATION.md](docs/ZOHO-INTEGRATION.md) for exactly what to ask for.
2. **Dealer login** and the dealer/customer view split.
3. The remaining mockup screens: profile, orders, saved products, price-list downloads,
   role switching.

**Undecided by the user:** whether the production build keeps Zoho Commerce as the backend, and
whether dealer login is custom or Zoho-backed.

## 9. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-18 | React + Vite + plain CSS, no framework | User's choice; keeps the draft runnable with no backend |
| 2026-09-18 | Real catalogue scraped, real photos downloaded locally | Credibility of the pitch; works offline |
| 2026-09-18 | Enquiry CTAs, no cart | Most catalogue items carry no public price; the real action is a conversation |
| 2026-09-18 | Mockup images are the binding visual direction | User supplied them as the theme |
| 2026-09-20 | **MRP hidden from the dealer view** | A dealer must not be able to read a customer price off their own screen |
| 2026-09-20 | **"Enquire Now" removed from product detail; "Share with Customer" kept** | A dealer with a price has nothing to enquire about |
| 2026-09-20 | **Dealer price is tap-to-reveal, account-specific** | Matches the mockup, and keeps pricing off a screen a customer might glance at |
| 2026-09-20 | Sample prices generated deterministically in one module | Lets the whole UI be built and reviewed before Zoho is connected; one file to replace later |
| 2026-09-20 | Roles built: guest / customer / pending dealer / approved dealer | The user asked for the full login scene, with admin approval gating dealer access |
| 2026-09-20 | Shareable product link `?from=<dealerId>` that always opens the customer view | A dealer shares a product with a walk-in customer; trade pricing must not travel with it |
| 2026-09-20 | The share link forces the customer view even for the sending dealer | A phone handed across a counter, or a forwarded link from a signed-in session, would otherwise leak trade pricing |
| 2026-09-20 | Customer view names the sharing dealer ("Available with …") | From mockup panel 4/5 — the link is the dealer's shopfront, so it must carry their name |
| 2026-09-20 | Dealer price lists on /schemes gated behind an approved dealer | Same rule as product pricing, same one-line guard |
| 2026-09-20 | Dealer price removed from listing cards — detail page only | A dealer scrolling a list in front of a customer should not have prices on screen |
| 2026-09-20 | The reveal is a toggle — "Hide Dealer Price" puts it away again | The dealer needs to clear the screen as fast as they filled it |
| 2026-09-20 | Related products moved below the detail grid | On a phone it was landing between the gallery and the product information |
| 2026-09-20 | Listing cards become rows on a phone; category moves between chip row and sidebar by breakpoint | Matches web mockup panel 2 and mobile mockup panel 3 — one component, CSS switch |
| 2026-09-20 | Star ratings and review counts left out despite being in the mockup | Fabricating reviews for a real company is not a placeholder, it is a fake |

## 10. Conventions worth knowing

- Spacing, colour, radius and shadow all come from custom properties in `src/styles.css`.
  Never hardcode a hex or a pixel gap — see [docs/DESIGN.md](docs/DESIGN.md).
- Accessibility baseline: keyboard-operable, visible focus, AA contrast, real alt text, survives
  200% zoom. The shop-floor context makes small-screen legibility non-negotiable.
- Non-trivial logic leaves one runnable check behind. Current example:
  `node src/data/dealer.test.mjs`.
- Money, price visibility and form validation are **not** places to be clever or terse.
