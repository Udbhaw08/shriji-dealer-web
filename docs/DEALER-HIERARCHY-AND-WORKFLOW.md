# DEALER-HIERARCHY-AND-WORKFLOW.md — Business, Dealer & Staff Hierarchy Model

This document specifies the multi-tier business hierarchy, the role of the **Dealer Code / Business Code**, and the two-level approval model between **Restor (Head/Platform)**, the **Dealer (Business Owner)**, and the **Staff (Shop Users)**.

---

## 1. The Three-Tier Hierarchy Model

```
                    ┌───────────────────────────────────┐
                    │      Restor / Shriji Domestic     │
                    │         (Platform / Head)         │
                    └─────────────────┬─────────────────┘
                                      │
                         Approves KYC & assigns
                         Dealer Code / Business Code
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │     Business Account (Zoho CRM)   │
                    │         e.g. "Udbhaw" / Firm      │
                    │   Account Name, GST, Address, Code│
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │         Dealer (Primary Admin)    │
                    │        Contact: Portal Role=Owner │
                    │     Controls the Dealer Dashboard │
                    └─────────────────┬─────────────────┘
                                      │
                         Approves / Revokes Staff
                         ("Yeh mera hi banda hai")
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │      Shop Staff / Users (Team)    │
                    │     Contact: Portal Role=Staff    │
                    │     Joined via Dealer Code        │
                    └───────────────────────────────────┘
```

### Hierarchy Breakdown:
1. **Level 0 — Platform Head (Restor / Shriji)**:
   - Operates in **Zoho CRM**.
   - Reviews the Dealer's application (business KYC, GST, address).
   - Grants approval by flipping `Dealer_Status` $\rightarrow$ `Approved`.
   - Assigns/generates the unique **Dealer Code / Business Code** and wholesale **Price Tier**.

2. **Level 1 — Business Account & Dealer (Shop Owner)**:
   - Represented as an **Account** in Zoho CRM (e.g., "Udbhaw Appliances").
   - The primary applicant is the **Owner Contact** (`Portal_Role = 'Owner'`).
   - Owns the Dealer Dashboard on the web/app.
   - Has access to wholesale pricing and team management.

3. **Level 2 — Users / Staff (Shop Employees)**:
   - Employees who work for that specific dealer.
   - Do **not** go through Restor KYC or GST verification.
   - Join directly by specifying the shop's **Dealer Code / Business Code**.
   - Created in Zoho CRM as **Contacts** under that same Business Account (`Portal_Role = 'Staff'`).

---

## 2. Two-Stage Approval Separation

| Entity to Approve | Who Approves? | Where is it Approved? | Approval Criteria |
|---|---|---|---|
| **Dealer (Business)** | **Restor Head** | **Zoho CRM** (`Accounts` module) | GST verification, commercial terms, KYC |
| **User (Staff Member)** | **Dealer (Shop Owner)** | **Dealer Dashboard** (`/dealer` on web/app) | Store owner confirms: *"This is my staff member"* |

> **Key Rule:** The Head (Restor) **never** approves individual staff members. Only the Dealer who owns the Business Code approves their team. Restor only approves the parent Dealer.

---

## 3. End-to-End User Journey & Life Cycle

### Phase A: Dealer Onboarding (Head Approval)
1. **Registration:** Dealer registers business name (e.g., "Udbhaw"), contact info, and GST on the portal.
2. **CRM Intake:** Backend creates a `Pending` Account and Owner Contact in Zoho CRM.
3. **Head Approval:** Restor admin opens Zoho CRM, verifies GST, clicks **Approve**, and assigns a unique `Dealer_Code` (e.g., `SHR-UDB-01`).
4. **Activation:** Zoho CRM webhook / 5-min poll syncs status to the backend. The Dealer Portal unlocks with wholesale prices.

---

### Phase B: Staff Onboarding via Dealer Code (Dealer Approval)
1. **Joining with Dealer Code:**
   - A staff member navigates to the portal $\rightarrow$ *"Join Store / Staff Signup"*.
   - Instead of complex random invite links, they enter:
     - Name & Email / Phone
     - **Dealer Code / Business Code** (e.g. `SHR-UDB-01`).
2. **Store Association:**
   - Backend matches `dealer_code` against `dealers` table.
   - The user is created with `role = 'dealer_staff'`, `status = 'pending'`, and linked to that dealer's `dealer_id`.
3. **CRM Association:**
   - A Contact is created under that dealer's Account in Zoho CRM with:
     - `Account_Name = { id: dealer.zoho_account_id }`
     - `Portal_Role = 'Staff'`
     - `Backend_User_ID = user.id`
4. **Dealer Approval in Dashboard:**
   - Staff member sees: *"Waiting for your shop owner to approve you"*.
   - Shop Owner opens [DealerDashboard.jsx](file:///c:/Users/udbha/Desktop/Webstore/src/pages/DealerDashboard.jsx) under **Your Team**.
   - Owner sees the pending staff member and clicks **Approve**.
   - Staff member status switches to `active`.
5. **Instant Revocation:**
   - If a staff member leaves the shop, the Dealer clicks **Revoke** on the dashboard.
   - Access tokens are cut instantly, preventing further wholesale access.

---

## 4. Zoho CRM Data Structure

### Accounts Module (Business Entity)
- `Account_Name`: Business name (e.g., "Udbhaw")
- `Dealer_Status`: Picklist (`Pending`, `Approved`, `Rejected`, `Revoked`)
- `Dealer_Code`: Text, Unique (e.g., `SHR-UDB-01`)
- `Price_List`: Picklist (e.g. `Mumbai PL May 2026`, `MH DP May 2026` — matching Zoho Commerce Price Lists)
- `GST_Number`: Text

### Contacts Module (People Hierarchy)
- `First_Name` / `Last_Name`: Person name
- `Account_Name`: Lookup $\rightarrow$ links to the Business Account
- `Portal_Role`: Picklist (`Owner`, `Staff`)
- `Backend_User_ID`: UUID linking to `users.id` in PostgreSQL

---

## 5. Technical Seams to Adapt

1. **Staff Registration Flow**:
   - Update `POST /api/auth/staff/signup` to accept `dealer_code` directly (in addition to or replacing hash-based invite strings).
2. **Frontend Staff Join Wizard**:
   - Provide a clean input: *"Enter your Shop's Dealer Code"* on the staff registration screen.
3. **Dealer Dashboard Display**:
   - Prominently showcase the Dealer Code and a *"Share Dealer Code with Team"* helper card.
