---
name: shriji-pricing-and-roles
description: >-
  Use this skill when working on pricing calculation, dealer wholesale rates,
  schemes, customer share links, zero-price resolution, or role-based access.
---

# Shriji Pricing & Roles Skill

This skill documents the pricing engine, user roles, permission boundaries, and sharing rules across the Shriji Dealer Web application.

## Key Files
- **`src/data/dealer.js`**: Share link generators, role viewer helpers (`viewerFor`), dealer registry.
- **`src/data/session.js`**: Local session storage state (guest, dealer, admin).
- **`src/components/PriceBlock.jsx`**: Price presentation logic and dealer rate unmasking.
- **`docs/PRICING-ARCHITECTURE.md`**: Master pricing specification and priority hierarchy.

## User Roles & View Modes

### 1. Guest View (Public)
- **Visible Price**: MRP only.
- **Dealer Price**: Masked. Prompts with "Are you a Sunshine retailer? Sign in for dealer pricing."

### 2. Dealer View (Authenticated)
- **Default State**: MRP visible. Wholesale dealer rate hidden behind "View Dealer Price" button.
- **Revealed State**: Shows Dealer Base Price, Trade Discount, GST (18%), Final Net Price, and Estimated Profit Margin.
- Includes quick "Share with Customer" action button.

### 3. Customer Shared View (`?from=<dealer_id>`)
- **Strict Rule**: Any URL containing `?from=` forces the Customer View for EVERYONE — including the dealer who sent it.
- Never reveals wholesale or dealer pricing.
- Displays MRP alongside: `"Available at [Dealer Shop Name]"`.
- If viewed by the dealer themselves, displays a warning banner: `"This is the customer view of your shared link"` with a button to toggle back to Dealer View.

## Zero-Price Handling
- If a product has no price or `0` in Zoho, it must display **"Price on Request"**.
- Never display `₹0`, `NaN`, or empty price blocks.
- Provides direct "Enquire via WhatsApp" and "Call Shriji" actions.

## Schemes Logic
- Active schemes reside in `src/data/site.js` (`SCHEMES.active`).
- Standard dealer scheme: **5 + 1** (Buy 5 units of select models, receive 1 unit free).
