# CODEBASE.md — Project Architecture & Feature Guide

> **Auto-generated documentation**
> Last synchronized: 2026-10-29T03:06:03.990+05:30 (GMT+5:30)
> Total Project Files: 1328

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
```
MRP = Label Rate (Printed MRP) > Selling Rate > Min Rate > 0
```
- **Label Rate > 0**: Sourced from variant label rate (e.g. ₹16,395 on 3B Verna Plus).
- **Selling Rate > 0**: Sourced from variant rate / selling price.
- **Zero / Unpriced Products**: Sourced as `mrp: 0` with `isPriceOnRequest: true`.
- **Formatting**: Sourced via `inr(n)` which returns `₹X,XXX` or `"Price on Request"`.

### 2.3 Guest Access Control & Portal Gating (`src/data/portalGate.js`)
When a user is not logged in or not verified as a dealer (`isPortalGated(session) === true`):
1. **Allowed Pages**:
   - **Home Page (`/`)**: Brand showcases, Hero slider, tagline, Customer Support card, Dealer Portal card, and Trust enquiry section.
   - **Support Page (`/support`)**: Service support requests, maintenance notices, and marketing contact.
   - **Direct Shared Product Links (`/products/:id` or with `?from=...`)**: Permitted for viewing single products shared by dealers.
2. **Hidden from Non-Login Users**:
   - **Shop by Category**: Completely hidden on the Home page.
   - **Featured / All Products Carousel**: Completely hidden on the Home page.
   - **Wholesale Schemes**: Active scheme flyers, PDF downloads, and scheme pages are completely hidden.
   - **Full Catalog Browsing (`/products`)**: Gated by `<RequireVerifiedDealer>`, automatically redirects to `/login?needAuth=true`.
   - **Schemes Page (`/schemes`)**: Gated by `<RequireVerifiedDealer>`, automatically redirects to `/login?needAuth=true`.

### 2.4 Shareable Product Link & Zero-Leakage Experience (`src/pages/Product.jsx`)
When a customer or non-logged-in user opens a link shared by a dealer:
- **Single Product Isolation**: Only that specific product is visible.
- **Customer Pricing Enforced**: Always displays retail MRP (never wholesale trade rates). If shared by a dealer, displays "Available with [Dealer Name]" and one-tap contact buttons.
- **Zero Catalog Leakage**:
  - Breadcrumbs display `Home > [Product Model]` (category link is omitted).
  - Search bar is hidden to prevent exploring the unauthenticated catalog.
  - Related products section ("More in this category") is hidden.
  - Top back button on mobile navigates directly back to `Home` (`/`).

### 2.5 Navigation & Bottom Bar Dynamic Filtering
- **Header & Mobile Drawer (`src/ui.jsx`)**: Non-login users only see `Home` and `Support` navigation tabs. `Products` and `Schemes` tabs appear only after approved dealer sign-in.
- **Mobile Bottom Navigation (`src/components/MobileBottomNav.jsx`)**: Non-login users have `Home`, `Support`, and the `Call for Details` bar. Full `Products` and `Schemes` tabs are reserved for approved dealers.
- **Footer (`src/ui.jsx`)**: Wholesale product categories and scheme links are replaced with `Quick Links` (Home, Support, Marketing) and `Dealer Portal` links for non-logged-in visitors.

---

## 3. Application Routes & Navigation

| Route Path | Component | Description |
|---|---|---|
| `/` | `Home` | Direct application route |
| `/products/:id` | `Product` | Direct application route |
| `/support` | `Support` | Direct application route |
| `/privacy` | `LegalPrivacy` | Direct application route |
| `/privacy-policy` | `LegalPrivacy` | Direct application route |
| `/terms` | `LegalTerms` | Direct application route |
| `/terms-of-service` | `LegalTerms` | Direct application route |
| `/data-deletion` | `LegalPrivacy` | Direct application route |
| `/login` | `Login` | Direct application route |
| `/dealer/apply` | `DealerApply` | Direct application route |
| `/dealer/join` | `StaffJoin` | Direct application route |
| `/join` | `StaffJoin` | Direct application route |
| `/dealer/pending` | `DealerPending` | Direct application route |
| `/admin` | `ContentAdminDashboard` | Direct application route |
| `/admin/content` | `ContentAdminDashboard` | Direct application route |
| `*` | `Navigate` | Direct application route |

---

## 4. Codebase Directory Map

### 4.1 Pages (`src/pages/`)
- **`src/pages/ContentAdminDashboard.jsx`** (74.3 KB)
- **`src/pages/DealerApply.jsx`** (0.4 KB)
- **`src/pages/DealerDashboard.jsx`** (52.6 KB)
- **`src/pages/DealerPending.jsx`** (18.7 KB)
- **`src/pages/Favorites.jsx`** (15.9 KB)
- **`src/pages/Home.jsx`** (21.4 KB)
- **`src/pages/LegalPrivacy.jsx`** (5.8 KB)
- **`src/pages/LegalTerms.jsx`** (4.2 KB)
- **`src/pages/Login.jsx`** (68.7 KB)
- **`src/pages/PrivacyPolicy.jsx`** (0.0 KB)
- **`src/pages/Product.jsx`** (36.2 KB)
- **`src/pages/Products.jsx`** (34.3 KB)
- **`src/pages/Schemes.jsx`** (17.6 KB)
- **`src/pages/StaffJoin.jsx`** (24.9 KB)
- **`src/pages/Support.jsx`** (28.7 KB)
- **`src/pages/TermsOfService.jsx`** (0.0 KB)

### 4.2 Reusable Components (`src/components/` & `src/ui.jsx`)
- **`src/components/A11yAnnouncer.jsx`** (0.5 KB)
- **`src/components/BrandApplyFlow.jsx`** (49.2 KB)
- **`src/components/EmailVerificationPrompt.jsx`** (10.0 KB)
- **`src/components/ErrorBoundary.jsx`** (0.8 KB)
- **`src/components/FileOrUrlInput.jsx`** (15.2 KB)
- **`src/components/HeroSlider.jsx`** (17.7 KB)
- **`src/components/MobileBottomNav.jsx`** (5.0 KB)
- **`src/components/NativeBackHandler.jsx`** (3.8 KB)
- **`src/components/NetworkStatusBadge.jsx`** (0.8 KB)
- **`src/components/PriceBlock.jsx`** (6.6 KB)
- **`src/components/ProductCard.jsx`** (3.9 KB)
- **`src/components/ProductSearchBar.jsx`** (17.1 KB)
- **`src/components/SkipToContent.jsx`** (0.7 KB)
- **`src/components/UnderMaintenance.jsx`** (2.1 KB)
- **`src/ui.jsx`**: Core UI components (Header, Footer, Icon, Search, CategoryCarousel).

### 4.3 State & Business Logic (`src/data/`)
- **`src/data/api.js`** (1.7 KB)
- **`src/data/auth-session.test.mjs`** (5.7 KB)
- **`src/data/auth.js`** (17.5 KB)
- **`src/data/dealer.js`** (9.0 KB)
- **`src/data/dealer.test.mjs`** (4.3 KB)
- **`src/data/favoritesStore.js`** (2.4 KB)
- **`src/data/i18n.js`** (1.8 KB)
- **`src/data/loginCode.js`** (3.2 KB)
- **`src/data/portalGate.js`** (0.8 KB)
- **`src/data/portalGate.test.mjs`** (1.1 KB)
- **`src/data/pricing.test.mjs`** (4.3 KB)
- **`src/data/products.js`** (1.8 KB)
- **`src/data/productsStore.js`** (6.2 KB)
- **`src/data/productsStore.test.mjs`** (5.2 KB)
- **`src/data/searchHelper.js`** (10.1 KB)
- **`src/data/searchHelper.test.mjs`** (0.9 KB)
- **`src/data/session.js`** (9.0 KB)
- **`src/data/site.js`** (3.8 KB)
- **`src/data/site.test.mjs`** (0.7 KB)
- **`src/data/translations.js`** (31.9 KB)
- **`src/data/validators.js`** (1.6 KB)
- **`src/data/video-banner.test.mjs`** (2.3 KB)

### 4.4 Zoho API & Serverless Handlers (`api/`)
- **`api/admin/login.js`** (2.5 KB)
- **`api/content.js`** (6.6 KB)
- **`api/dealer/apply.js`** (1.0 KB)
- **`api/dealer/info.js`** (2.0 KB)
- **`api/download.js`** (8.3 KB)
- **`api/og.js`** (5.1 KB)
- **`api/products/index.js`** (2.7 KB)
- **`api/products/sync-tags.js`** (0.9 KB)
- **`api/products/[id].js`** (2.0 KB)
- **`api/upload.js`** (10.9 KB)
- **`api/_lib/adminAuth.js`** (1.6 KB)
- **`api/_lib/dealerPricingAuth.js`** (4.1 KB)
- **`api/_lib/htmlEscape.js`** (1.1 KB)
- **`api/_lib/ssrf.js`** (5.8 KB)
- **`api/_lib/zoho.js`** (43.5 KB)

### 4.5 Automation & Utility Scripts (`scripts/`)
- **`scripts/audit_prices.mjs`** (3.9 KB)
- **`scripts/check-env.mjs`** (0.3 KB)
- **`scripts/export_pricebooks_for_crm.mjs`** (3.0 KB)
- **`scripts/generate-codebase-doc.mjs`** (9.3 KB)
- **`scripts/get-refresh-token.mjs`** (2.3 KB)
- **`scripts/make-scheme-pdfs.mjs`** (2.2 KB)
- **`scripts/sync-all.mjs`** (2.0 KB)
- **`scripts/test-supabase.mjs`** (0.6 KB)
- **`scripts/test-zoho-api.mjs`** (1.4 KB)
- **`scripts/verify-all.mjs`** (0.3 KB)
- **`scripts/watch-sync.mjs`** (1.5 KB)

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

## 7. Development & Git Workflow Guidelines
- **No Automatic Pushes**: Never run `git push` or trigger remote deployment without explicit instruction from the user. Keep work local until instructed.
- **Continuous Documentation**: Whenever adding, renaming, or refactoring features, run:
```bash
npm run docs
```
This script parses the live repository and keeps `CODEBASE.md` in continuous synchronization.
