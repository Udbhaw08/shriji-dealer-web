# ReStor Dealer Web — Auth Architecture Analysis: Firebase vs Supabase

**Document Version:** 1.0.0  
**Generated Date:** 2026-10-11  
**Project:** Shriji Domestic Appliances — ReStor Dealer Web (`Udbhaw08/shriji-dealer-web`)  
**Scope:** Complete codebase audit of Supabase & Firebase usage across all 4 portals/ways (Dealer, Staff, Brand, Customer) and the unified Firebase Authentication specification.

---

## 1. Executive Summary & Clarification

There has been significant discussion regarding whether **Supabase** or **Firebase** is used for user authentication and backend storage. This audit provides an authoritative, code-level clarification:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ARCHITECTURE AT A GLANCE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌────────────────────────────────┐         ┌──────────────────────────────┐   │
│   │     GOOGLE FIREBASE SDK        │         │      SUPABASE POSTGRES       │   │
│   │    (Identity & Auth Layer)     │         │   (Relational Data Store)    │   │
│   ├────────────────────────────────┤         ├──────────────────────────────┤   │
│   │ • Phone SMS OTP (India + Intl) │         │ • users table                │   │
│   │ • 1-Click Google OAuth Popup   │         │ • dealers table              │   │
│   │ • Recaptcha bot protection     │         │ • staff_invites table        │   │
│   │ • Firebase ID Token issuance   │         │ • audit_logs table           │   │
│   │ • Google Analytics 4           │         │ • refresh_tokens table       │   │
│   │                                │         │ • Zero Supabase Auth SDK!    │   │
│   └───────────────┬────────────────┘         └──────────────▲───────────────┘   │
│                   │                                         │                   │
│                   │ ID Token                                │ SQL Pool          │
│                   ▼                                         │ (postgres npm)    │
│   ┌─────────────────────────────────────────────────────────┴───────────────┐   │
│   │                     NODE.JS DEDICATED BACKEND (Express)                 │   │
│   │  • Validates Firebase ID Tokens (/api/auth/firebase)                    │   │
│   │  • Enforces Dealer / Staff / Customer / Brand role gating               │   │
│   │  • Syncs Dealer & Staff accounts to Zoho CRM (Accounts & Contacts)      │   │
│   │  • Issues app session JWTs (accessToken + refreshToken)                 │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Takeaways:
1. **Supabase Auth is NOT used anywhere in this repository.**  
   The `@supabase/supabase-js` package is not installed in the frontend or backend. Neither Supabase GoTrue nor Supabase user sessions exist.
2. **Supabase is exclusively used as hosted PostgreSQL.**  
   Our Node.js backend connects to Supabase's AWS PostgreSQL instance (`aws-0-ap-south-1.pooler.supabase.com:5432`) via the native `postgres` npm driver to store application tables (`users`, `dealers`, `staff_invites`, `audit_logs`).
3. **Firebase is the sole Identity & Authentication engine.**  
   Frontend utilizes Firebase Web SDK (`firebase/auth`) for Phone SMS OTP and Google Sign-in.
4. **Mandate:** Authentication across all **4 portals/ways** (ReStor Dealer, ReStor Staff, ReStor Brand, ReStor Customer) is unified under **Firebase Authentication**, while business roles, dealer approvals, and Zoho sync continue to be governed by the Node backend and PostgreSQL.

---

## 2. Codebase Inventory: Where Each Technology Lives

### 2.1 Where Supabase Is Used (Database Layer Only)

| File / Location | Purpose / Usage | Supabase Role |
| :--- | :--- | :--- |
| `backend/.env` | `DATABASE_URL=postgresql://postgres...aws-0-ap-south-1.pooler.supabase.com:5432/postgres` | Hosted PostgreSQL connection string |
| `backend/src/db/pool.js` | Direct PostgreSQL connection pool via `postgres` driver | Database queries (NO Supabase client) |
| `backend/src/db/migrate.js` | Runs SQL migrations against PostgreSQL | Schema migrations (`schema_migrations` table) |
| `.mcp.json` | Local developer tool integration | Supabase MCP server for inspection |
| `docs/BACKEND-ARCHITECTURE.md` | Architectural specification | Relational store definition (PostgreSQL) |

> **Crucial Fact:** If Supabase Postgres is replaced with any other PostgreSQL host (Neon, AWS RDS, Render, self-hosted Postgres), zero authentication or frontend code would break because Supabase Auth was never wired.

---

### 2.2 Where Firebase Is Used (Authentication & Client Telemetry)

| File / Location | Component / Symbol | Firebase Role |
| :--- | :--- | :--- |
| `package.json` | `"firebase": "^13.0.0"` | Client SDK dependency |
| `src/data/firebase.js` | `initializeApp(firebaseConfig)` | Client app initialization (`authentication-511306`) |
| `src/data/firebase.js` | `sendFirebasePhoneOtp()` | RecaptchaVerifier + SMS OTP dispatch via Firebase |
| `src/data/firebase.js` | `verifyFirebasePhoneOtp()` | Confirmation code verification & Firebase ID Token extraction |
| `src/data/firebase.js` | `signInWithGoogleFirebase()` | Google Auth Provider popup & ID Token extraction |
| `src/data/firebase.js` | `getAnalytics(firebaseApp)` | Google Analytics 4 event measurement |
| `src/data/auth.js` | `firebaseAuthLogin(idToken)` | Transmits Firebase ID Token to backend `/api/auth/firebase` |
| `backend/src/routes/auth.js` | `POST /api/auth/firebase` | Verifies ID token with Google Identity Toolkit REST API, resolves user in DB, issues session JWT |
| `backend/.env` | `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` | API keys for backend token verification |

---

## 3. Detailed Audit of the 4 Portals / 4 Ways

The application supports four user roles/portals defined in `src/pages/Login.jsx`:

```javascript
const ROLES = [
  { id: "owner", name: "ReStor Dealer", sub: "Manage your store and team" },
  { id: "staff", name: "ReStor Staff", sub: "Access products and tools" },
  { id: "brand", name: "ReStor Brand", sub: "Coming soon", disabled: true },
  { id: "customer", name: "ReStor Customer", sub: "Browse retail prices" },
];
```

---

### Portal 1: ReStor Dealer (Shop Owner)

* **Target User:** Proprietor, retail store owner, or authorized purchasing manager.
* **Role in System:** `role = 'dealer'`, owner of a `dealers` row.
* **Access Level:** Masked dealer wholesale pricing, 5+1 scheme calculation, staff management, Zoho Commerce dealer pricebook.

#### Current Authentication Flow:
1. **Identity Step (`owner-identify`):**
   * **Phone SMS OTP (Firebase):** User inputs mobile number $\rightarrow$ `sendFirebasePhoneOtp()` dispatches SMS OTP via Firebase Phone Auth with invisible ReCAPTCHA $\rightarrow$ User submits OTP $\rightarrow$ `verifyFirebasePhoneOtp()` gets Firebase `idToken` $\rightarrow$ `firebaseAuthLogin(idToken)` exchanges token with backend `/api/auth/firebase`.
   * **Google Sign-In (Firebase):** 1-Click popup via `signInWithGoogleFirebase()` $\rightarrow$ ID token exchanged via `/api/auth/firebase`.
   * **Password / Email Fallback:** Can authenticate with stored password or backend email OTP.
2. **Business Registration Step (`owner-details` / `owner-match`):**
   * If user has no existing dealer account, prompts for Business Name, GST Number, PAN, Address, Contact Person.
   * Calls `applyAsDealer()` $\rightarrow$ `POST /api/dealers/apply`.
3. **Approval Gating (`owner-review`):**
   * Record enters `status = 'pending'`.
   * Auto-syncs to Zoho CRM `Accounts` module as a lead/account with `Store_Code` / `Dealer_Code`.
   * User UI is held on the review screen; polls `/api/auth/me` until Zoho CRM webhook or polling script sets `status = 'approved'`.
4. **Active Session:**
   * Once approved, unlocks `/dealer` team dashboard and `/products` wholesale prices.

#### Verification & Firebase Status:
* [x] **Firebase Phone OTP active and working.**
* [x] **Firebase Google Sign-In active and working.**
* [x] **Backend ID token exchange active (`/api/auth/firebase`).**
* [x] **Role gating intact (non-approved dealers cannot access wholesale rates).**

---

### Portal 2: ReStor Staff (Store Staff / Counter Team)

* **Target User:** Salesperson, billing clerk, or counter staff employed by an authorized dealer.
* **Role in System:** `role = 'dealer_staff'`, linked to a parent `dealer_id`.
* **Access Level:** View wholesale prices to assist counter customers, generate customer quote links, restricted from editing dealer GST or team settings.

#### Current Authentication Flow:
1. **Selection Step (`staff-newexist`):**
   * User chooses between **"Existing Staff Login"** and **"New User — Join with Dealer Code"**.
2. **Existing Staff Path (`staff-login`):**
   * Staff logs in directly using their verified **Phone SMS OTP (Firebase)** or **Email/Password**.
   * Backend validates credentials and checks status:
     * `status = 'active'`: Directly granted access to `/products`.
     * `status = 'pending'`: Directed to `staff-waiting` screen.
     * `status = 'hold'`: Directed to `staff-hold` screen.
3. **New Staff Signup Path (`staff-invite` $\rightarrow$ `staff-details` $\rightarrow$ `staff-otp`):**
   * **Step 1:** Enters Dealer Code (e.g., `SHR-DL-001`) $\rightarrow$ validated in real time via `lookupStaffCode()`.
   * **Step 2:** Fills Name, Mobile Number, Email, Password.
   * **Step 3:** Verifies phone number with **Firebase Phone SMS OTP**.
   * **Step 4:** Calls `staffSignup()` $\rightarrow$ `POST /api/auth/staff/signup`.
   * **Step 5:** Record created in `users` with `role = 'dealer_staff'`, `status = 'pending'`, and auto-creates a linked Contact under the Dealer Account in Zoho CRM.
4. **Dealer Owner Governance:**
   * The staff member cannot view products until the Dealer Owner clicks **"Approve"** on the Dealer Dashboard or the CRM status is updated.

#### Verification & Firebase Status:
* [x] **Firebase Phone OTP active for staff phone verification.**
* [x] **Existing staff login flow active with Firebase OTP support.**
* [x] **Dealer Code validation & staff limit enforcement working.**
* [x] **Status hold / revoke / approve controls working.**

---

### Portal 3: ReStor Brand (Sunshine Brand Managers & Field Execs)

* **Target User:** Sunshine Domestic Appliances brand representatives, sales managers, factory dispatchers.
* **Role in System:** `role = 'brand'` / `'brand_manager'`.
* **Access Level:** Brand catalog controls, SKU stock status, regional dealer visibility, retail performance telemetry.

#### Target Firebase Unified Flow:
1. **Authentication Mode:**
   * **Google Workspace SSO via Firebase:** Brand managers log in with official Sunshine corporate emails (e.g. `*@sunshine.in` or authorized domain) via `signInWithGoogleFirebase()`.
   * **Firebase Email Link (Passwordless) / Email-Password:** Fallback for external brand partners.
2. **Role Mapping in Backend:**
   * When `POST /api/auth/firebase` receives a corporate domain or an account pre-seeded in the `users` table with `role = 'brand'`, the backend issues a brand-tier JWT.
3. **Current Code Status:**
   * UI entry is currently marked as `{ id: "brand", name: "ReStor Brand", sub: "Coming soon", disabled: true }`.
   * Ready for activation once brand dashboard views are rendered.

---

### Portal 4: ReStor Customer (End Consumer / Retail Buyer)

* **Target User:** Homeowner, cooking enthusiast, retail walk-in customer.
* **Role in System:** `role = 'customer'` (or anonymous `guest`).
* **Access Level:** Strictly MRP and retail promotional prices. Dealer wholesale prices and dealer tiering are 100% masked.

#### Current Authentication Flow:
1. **Guest Browse (Immediate Access):**
   * In `Login.jsx`, picking "ReStor Customer" sets an instant guest session:
     ```javascript
     setSession({ role: "customer", status: "approved", person: "Customer" });
     nav("/products");
     ```
   * Instant retail browse with zero registration hurdle.
2. **Authenticated Customer Account (Firebase):**
   * When a customer wants to log in or register to save favorites, sync shopping cart, and track orders:
   * They authenticate with **Firebase Phone SMS OTP** or **Firebase 1-Click Google Sign-in**.
   * Backend `/api/auth/firebase` automatically assigns `role = 'customer'`, `status = 'active'`, `email_verified = true`.
3. **Pricing Isolation:**
   * Customers never see dealer rates. If a dealer shares a product link with a `?from=` parameter, customer-mode is permanently forced.

#### Verification & Firebase Status:
* [x] **Immediate guest access operational.**
* [x] **Firebase sign-in auto-provisions `customer` role safely.**
* [x] **Zero price leak to customer sessions.**

---

## 4. Architectural Matrix: Supabase vs Firebase

| Architecture Dimension | Supabase in Project | Firebase in Project |
| :--- | :--- | :--- |
| **Authentication (SMS OTP)** | ❌ Not used | ✅ **Primary engine** via `firebase/auth` Phone Provider |
| **Authentication (Google OAuth)** | ❌ Not used | ✅ **Primary engine** via `signInWithPopup(GoogleAuthProvider)` |
| **Authentication (Email OTP / Pass)**| ❌ Not used (Was custom Node/Resend) | 🔄 **Target unified provider** |
| **User Identity Database** | ✅ User rows stored in Supabase Postgres | ❌ Firebase DB (Firestore/RTDB) NOT used |
| **Dealer Business Records** | ✅ Stored in Supabase Postgres (`dealers` table) | ❌ Not used |
| **Application Session JWTs** | ❌ Issued by Node.js backend (`jsonwebtoken`) | ❌ Firebase token used only for identity proof |
| **Zoho CRM & Commerce Sync** | ✅ Linked via PostgreSQL foreign keys | ❌ Not used |
| **Client Analytics** | ❌ Not used | ✅ Active via Firebase Analytics (`G-Z92GRS392K`) |

---

## 5. Verification Checklist & Action Plan

1. **Keep Supabase strictly as PostgreSQL:**
   * Supabase continues to manage database tables (`users`, `dealers`, `staff_invites`, `audit_logs`).
   * No Supabase Auth packages will be introduced.
2. **Consolidate all Identity Verification into Firebase:**
   * **Dealer Portal:** Uses Firebase Phone SMS OTP and Firebase Google Sign-in.
   * **Staff Portal:** Uses Firebase Phone SMS OTP for new registrations and existing logins.
   * **Customer Portal:** Uses 1-click Firebase Google Sign-in & Phone OTP.
   * **Brand Portal:** Ready for Firebase Google SSO upon release.
3. **Backend Token Exchange:**
   * All client auth flows converge on `POST /api/auth/firebase`.
   * Backend verifies the Firebase token, checks user roles in PostgreSQL, and returns unified app sessions.
4. **Knowledge Graph & Sync:**
   * System re-indexed using `graphify update .` to ensure complete documentation and symbol graph freshness.

---

*Authored by Antigravity Agent for Shriji Domestic Appliances.*
