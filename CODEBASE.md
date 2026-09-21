# CODEBASE.md — Project Architecture & Feature Guide

> **Auto-generated documentation**
> Last synchronized: 2026-09-21T11:06:05.652Z
> Total Project Files: 46

---

## 1. System Overview

**Shriji Domestic Appliances (Sunshine)** dealer and customer web application.
- **Frontend**: React 19, React Router v7, Vanilla CSS design system, Vite 8.
- **Backend / Integration**: Zoho Commerce Store API (Catalog & Variants) + Zoho Books API (Contacts, Customer Portal & Pricebooks).
- **Deployment**: Vercel Serverless / Static Frontend + API serverless functions.

---

## 2. Core Pricing & Identity Architecture

### 2.1 The Two Audiences (Zero Leakage Rule)
1. **Customer View**:
   - Sees **only printed MRP** (Label Price) or Selling Price as listed in Zoho Commerce.
   - Any link shared by a dealer with `?from=<dealer_id>` forces customer view for everyone (even the dealer who opened it).
   - If a product has no price or `0` in Zoho, it displays **"Price on Request"** (never a synthetic/fake number).
2. **Dealer View**:
   - Requires an approved dealer account authenticated via phone/email registered in Zoho Books contacts.
   - Whole-order trade discount or custom pricebook rate (e.g. KuchenBau Electric Kettle @ ₹1,025).
   - Dealer rates on product details are **masked behind "View Dealer Price"** (`₹ • • • •`) to protect trade secrets on public or in-store screens.

### 2.2 Pricing Resolution Engine (`api/zoho.js` & `src/data/dealer.js`)
$$\text{mrp} = \text{Label Rate (Printed MRP)} > \text{Selling Rate} > \text{Min Rate} > 0$$

- **Label Rate > 0**: Sourced from variant label rate (e.g. ₹16,395 on 3B Verna Plus).
- **Selling Rate > 0**: Sourced from variant rate / selling price.
- **Zero / Unpriced Products**: Sourced as `mrp: 0` with `isPriceOnRequest: true`.
- **Formatting**: Sourced via `inr(n)` which returns `₹X,XXX` or `"Price on Request"`.

---

## 3. Application Routes & Navigation

| Route Path | Component | Description |
|---|---|---|
| `/` | `Home` | Direct application route |
| `/products` | `Products` | Direct application route |
| `/products/:id` | `Product` | Direct application route |
| `/schemes` | `Schemes` | Direct application route |
| `/support` | `Support` | Direct application route |
| `/login` | `Login` | Direct application route |
| `*` | `Product` | Direct application route |

---

## 4. Codebase Directory Map

### 4.1 Pages (`src/pages/`)
- **`src/pages/Home.jsx`** (7.3 KB)
- **`src/pages/Login.jsx`** (23.5 KB)
- **`src/pages/Product.jsx`** (14.3 KB)
- **`src/pages/Products.jsx`** (13.1 KB)
- **`src/pages/Schemes.jsx`** (6.2 KB)
- **`src/pages/Support.jsx`** (12.8 KB)

### 4.2 Reusable Components (`src/components/` & `src/ui.jsx`)
- **`src/components/PriceBlock.jsx`** (4.4 KB)
- **`src/components/ProductCard.jsx`** (1.6 KB)
- **`src/ui.jsx`**: Core UI components (Header, Footer, Icon, Search, CategoryCarousel).

### 4.3 State & Business Logic (`src/data/`)
- **`src/data/dealer.js`** (4.8 KB)
- **`src/data/dealer.test.mjs`** (3.1 KB)
- **`src/data/pricing.test.mjs`** (3.3 KB)
- **`src/data/products.js`** (1.1 KB)
- **`src/data/productsStore.js`** (2.8 KB)
- **`src/data/session.js`** (2.4 KB)
- **`src/data/site.js`** (4.5 KB)

### 4.4 Zoho API & Serverless Handlers (`api/`)
- **`api/dealer/apply.js`** (0.7 KB)
- **`api/dealer/info.js`** (0.6 KB)
- **`api/dealer/login.js`** (0.8 KB)
- **`api/products/index.js`** (0.9 KB)
- **`api/products/[id].js`** (0.8 KB)
- **`api/zoho.js`** (17.2 KB)

### 4.5 Automation & Utility Scripts (`scripts/`)
- **`scripts/audit_prices.mjs`** (3.8 KB)
- **`scripts/generate-codebase-doc.mjs`** (6.3 KB)
- **`scripts/get-refresh-token.mjs`** (2.3 KB)
- **`scripts/test-zoho-api.mjs`** (2.1 KB)

---

## 5. Zoho API Endpoints

### 5.1 Zoho Commerce Storefront API
- **Endpoint**: `https://commerce.zoho.in/store/api/v1/products`
- **Catalog Size**: 433 live products (Appliances, Chimneys, Gas Stoves, Hobs, Hob Tops, Gas Geysers, Natraj Flour Mills, Spares).
- **Images**: CDN base `https://cdn2.zohoecommerce.com/product-images/{file_name}/{document_id}/600x600?storefront_domain=www.shrijidomestic.com`.

### 5.2 Zoho Books Contacts & Pricebooks API
- **Endpoint**: `https://www.zohoapis.in/books/v3/contacts`
- **Authentication**: Contact lookup by normalized phone or email.
- **Status Validation**: Checks `status === 'active'` or `portal_status === 'enabled'`.
- **Pricebooks**: Respects `pricebook_id` and `pricebook_name` (e.g. "Mumbai PL May 2026").

### 5.3 Auto-Recovery Token Architecture
- `fetchZohoWithRetry(url, options)`: Automatically intercepts HTTP 401 Unauthorized, unlinks expired token cache, requests a new OAuth access token from Zoho OAuth v2, and retries the request seamlessly.

---

## 6. How to Run & Verify

```bash
# Start Vite development server
npm run dev

# Run full automated regression tests (pricing & dealer security)
npm test

# Build production bundle
npm run build

# Synchronize and update CODEBASE.md
npm run docs

# Audit live pricing against CSV export
node scripts/audit_prices.mjs
```

---

## 7. How to Maintain this Document
Whenever adding, renaming, or refactoring features, run:
```bash
npm run docs
```
This script parses the live repository and keeps `CODEBASE.md` in continuous synchronization.
