# PRICING-ARCHITECTURE.md — Pricing Engine & Audit Specification

This document details how pricing is fetched, parsed, normalized, audited, and rendered across the Shriji Domestic Appliances platform.

---

## 1. Source of Truth: Live Zoho Commerce Store API

All product prices originate directly from the live Zoho Commerce storefront API:
- **API Endpoint**: `https://commerce.zoho.in/store/api/v1/products`
- **Method**: HTTP GET with `Zoho-oauthtoken` and `X-com-zoho-store-organizationid`
- **Total Products**: 433

### Rate Priority Hierarchy
In `api/zoho.js` -> `normalizeProduct(p)`:
```javascript
const labelRate = parseRate(variant.label_rate);
const sellingRate = parseRate(variant.rate);
const minRate = parseRate(p.min_rate);

// Customer retail price (MRP):
const mrp = labelRate > 0 ? labelRate : (sellingRate > 0 ? sellingRate : (minRate > 0 ? minRate : 0));
```

1. **`label_rate` (Printed MRP)**:
   - Takes top priority when configured and > 0.
   - Example: On *3B Verna Plus GS Sunshine*, Zoho sets Selling Price as `INR 0.00` but Label Price as `INR 16,395.00`. The system correctly resolves `mrp = 16395`.
2. **`rate` (Selling Price)**:
   - Used when `label_rate` is 0 or unassigned.
   - Example: *HOSE PIPE 1.5 MT SUNSHINE* (Selling Price: ₹118, Label Price: 0). The system resolves `mrp = 118`.
3. **`min_rate`**:
   - Secondary fallback for products where variant rates are omitted.
4. **`0` (Unpriced / Spares / On-Demand)**:
   - If all rate fields are 0 or empty, `mrp = 0`.
   - **Critical Rule**: Zero-priced items NEVER fall back to synthetic hash prices.

---

## 2. Customer vs. Dealer Price Resolution (`src/data/dealer.js`)

### 2.1 Customer View
- Customers always see **Retail MRP**.
- Unpriced items display **"Price on Request"** with a direct WhatsApp/Phone call to the dealer or company.
- Formatted using `inr(n)`:
  - `n > 0` -> `₹X,XXX`
  - `n <= 0` -> `"Price on Request"`

### 2.2 Dealer View
- Available strictly to signed-in dealers with an approved status in Zoho Books.
- **Whole-Catalog Rebate**: Standard approved dealers get their contracted rebate (default: 20% off MRP).
- **Custom Pricebook Exceptions**:
  - *KuchenBau Electric Kettle (1.8L)* (`3334672000000194828`): Dealer rate is strictly locked to **₹1,025** (matching Zoho Pricebook "Mumbai PL May 2026").
- **UI Masking**:
  - Trade pricing is masked by default on the product detail page (`₹ • • • •`) behind a **"View Dealer Price"** toggle to prevent accidental disclosure to retail customers in physical showrooms.

### 2.3 Share Link Invariant
- Links shared with `?from=<dealer_id>` unconditionally force the **Customer View** for all viewers, ensuring customer links never expose dealer net margins.

---

## 3. Automated Pricing Regression Protection

To guarantee that pricing discrepancies or synthetic fallbacks never return, the project includes automated regression tests in `src/data/pricing.test.mjs`:
- Tested on every build and CI via `npm test`.
- Checks zero-price products, real catalog items, label price vs selling price precedence, and dealer net calculations.

To run the regression suite:
```bash
npm test
```

To run a live audit comparing all 433 products against a Zoho CSV export:
```bash
node scripts/audit_prices.mjs
```
