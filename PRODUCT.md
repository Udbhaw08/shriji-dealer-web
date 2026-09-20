# Product

<!-- impeccable:product-schema 1 -->

> **Note for anyone reading this file on its own (added 2026-09-20).** This is the original
> direction contract, written at project birth. It is still binding on visual direction, but it is
> no longer the whole picture, and two statements below are now stale:
>
> - It says the catalogue spans **six** categories including Gas Geysers. The scraped data contains
>   **five** — there are no gas geyser products. The code is right; this prose is not. Do not add
>   invented products to reconcile them.
> - It says "most products have no public selling price — use enquiry CTAs". The dealer view has
>   since moved to tap-to-reveal dealer pricing with no MRP and no enquiry button.
>
> Current state lives in [PRD.md](PRD.md); the product pages are specified in
> [docs/PRODUCT-PAGES.md](docs/PRODUCT-PAGES.md).

## Platform

web

## Stack

React (Vite) + react-router-dom, plain CSS with design tokens. No CSS framework. Chosen by the user; kept build-light so the demo runs from `npm run dev` with no backend.

## Users

**Primary (this phase): dealers and retailers of Shriji Domestic Appliances.** Kitchen-appliance shop owners and their staff across India who stock the Sunshine brand. Their job: see the current range, check what is new, track active dealer schemes and offers, pull price lists and marketing material, raise service requests, and reach the distributor fast.

**Secondary: prospective dealers** evaluating whether to sign up with Shriji.

**Future (not built now, but the structure must not block it):** a role-based system with dealer login and a separate consumer-facing interface. The user explicitly flagged this as a later enhancement.

## Product Purpose

Shriji Domestic Appliances Pvt. Ltd. is a distributor of domestic kitchen appliances — gas stoves, hobs, hob tops, chimneys, gas geysers and small appliances — carrying the Sunshine India brand. The website exists to present the full range credibly to the dealer network, to make dealer-facing material (schemes, price lists, marketing assets, service) easy to reach, and to convert new retailers into partners.

Success: a dealer finds the model they need and the current scheme without calling anyone; a new retailer submits a dealership enquiry.

## Positioning

25+ years of distribution depth in one brand's kitchen line, not a marketplace. Volume and reach are the proof: ~4,000 products installed monthly across ~1,000 retailers, 4,500+ customers served each month. Confirmed facts from the incumbent site.

## Operating Context

Dealers browse on phones in a shop, often mid-conversation with a customer, frequently on poor connections. They think in model names and burner counts (`3B Carnival Plus Auto Tablet Hob`, `60 Dijon BLDC CH`), not in marketing copy. WhatsApp is a primary contact channel. Enquiry, not checkout, is the real action on the current site — most catalog items carry no public price.

## Capabilities and Constraints

- Catalog spans six categories: Gas Stoves, Hobs, Hob Tops, Chimneys, Gas Geysers, Small Appliances. Real counts scraped from the live store: gas stoves 50+, chimneys 50+, hobs 26, hob tops 24, small appliances 12.
- Product naming convention is `<burners/size> <ModelName> <finish> <category code> <brand>` — e.g. `4B Magic Plus SS GS Sunshine`, `90 Casavo BLDC CH Sunshine`.
- Brands present in the catalog: **Sunshine** (primary) and **KuchenBau** (select small appliances).
- Most products have no public selling price. Do not invent prices — use enquiry CTAs.
- The incumbent site runs on Zoho Commerce; product images are served from `cdn2.zohoecommerce.com`. This demo ships downloaded copies locally so it works without network.
- **Undecided:** whether the real build keeps Zoho Commerce as backend, and whether dealer login is custom or Zoho-backed.

## Brand Commitments

- Legal name: Shriji Domestic Appliances Pvt. Ltd. Product brand: Sunshine (Sunshine India).
- Founded 1999.
- Existing logo asset: `Copy of SDA Logo Options 2.png` on the incumbent CDN.
- **Binding visual constraint given by the user:** the supplied dealer-app mockup sets the theme — deep navy primary, soft blue-grey surfaces, white cards, rounded corners, clean and quiet. Taglines from the mockup: "Better Products, Stronger Partners, Brighter Homes" and "Engineered for a Better Tomorrow".

## Evidence on Hand

Real, scraped from shrijidomestic.com (2026-09-18):

- 162 product names with category mapping and CDN image URLs → `src/data/products.js`
- Stats: Since 1999 · 25+ Years in Business · 4500+ customers served each month · 4000+ products installed monthly · 1000+ retailers tapped
- About copy: "Since 1999, we have been a leading distributor of domestic kitchen appliances, specializing in gas stoves and chimneys."
- Contact: +91 77383 69367 · contact@shrijidomestic.com · Motilal Nagar 1, Goregaon West, Mumbai
- Category hero images for all six categories

**Absent — must not be fabricated as real:** prices, testimonials, dealer names, certifications, warranty terms, awards, GST/legal registration numbers. Where the demo needs placeholder content (scheme details, dealer testimonials), it is labelled as sample content.

## Product Principles

1. **Model name first.** A dealer scanning for `3B Carnival Plus` must find it faster than they could phone someone. Names, burner counts and finishes are the real information architecture.
2. **Enquiry over checkout.** The conversion is a conversation — WhatsApp, call, dealership form — not a cart.
3. **Range as proof.** Depth of catalog is the distributor's credibility. Show breadth honestly; never pad it with invented SKUs.
4. **Phone-first, shop-floor reality.** Works one-handed, on a mid-range Android, on a weak connection.
5. **Leave the door open for roles.** Nothing in the structure should have to be torn out when dealer login and a consumer interface arrive.

## Accessibility & Inclusion

No standard was specified. Baseline: keyboard-operable navigation, visible focus, AA contrast on all text, real alt text on product imagery, and layouts that survive 200% zoom — the shop-floor context makes small-screen legibility non-negotiable.
