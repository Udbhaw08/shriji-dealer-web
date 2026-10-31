# 🗺️ Shriji Dealer Web — Service Infrastructure Document

> **Project:** Shriji Domestic Appliances — Sunshine Dealer Web (`restor.in`)
> **Last Updated:** October 2026
> **Total Active Services:** 8
> **Monthly Cost (current):** \$0 *(backend suspended)*
> **Monthly Cost (after fix):** ~₹580/month

---

## 🖥️ 1. Backend Hosting — **Render** (Node.js Server)
| | Detail |
|---|---|
| **Kya karta hai** | Auth, JWT sessions, OTP flow, Zoho CRM sync, dealer applications, price proxy, background jobs (crmPoll every 1 min, catalogSync) |
| **Current Plan** | **Free** — 750 hrs/month, sleeps after 15 min inactivity |
| **Status** | 🔴 **SUSPENDED** — Free limit exhaust ho gayi |
| **Next Plan** | **Starter — \$7/month** (always-on, no sleep, Singapore region) |
| **Upgrade kab zaruri** | **ABHI** — service band hai. Background jobs (CRM polling) ke liye 24/7 uptime chahiye |
| **Starter pe kitna sambhega** | 512MB RAM, 0.5 CPU — hundreds of concurrent dealers tak easily sambhega |

> [!CAUTION]
> Yahi service abhi down hai. Jab tak yeh nahi uthega, login, OTP, dealer approval — kuch bhi kaam nahi karega.

---

## 🌐 2. Frontend Hosting — **Vercel**
| | Detail |
|---|---|
| **Kya karta hai** | React frontend serve karta hai (`restor.in`, `www.restor.in`, `test.restor.in`) |
| **Current Plan** | **Hobby (Free)** — 100GB bandwidth/month, serverless functions included |
| **Next Plan** | **Pro — \$20/month** |
| **Upgrade kab zaruri** | Jab traffic badhega (~50,000+ monthly visitors), ya team members chahiye hon, ya SLA guarantee chahiye |
| **Abhi koi issue** | ✅ Fine hai |

---

## 🗄️ 3. Database — **Supabase** (PostgreSQL)
| | Detail |
|---|---|
| **Kya karta hai** | Users table, dealers table, OTP codes, audit logs, store content (banners, schemes, branding), file storage buckets (hero-banners, schemes, branding, webstore-assets) |
| **Current Plan** | **Free** — 500MB DB, 1GB file storage, 2 projects max |
| **Next Plan** | **Pro — \$25/month** |
| **Upgrade kab zaruri** | Jab DB size ~400MB cross kare, ya project pause hone lage (free projects 7 days inactivity pe pause ho jaate hain), ya daily backups chahiye hon |
| **Abhi koi issue** | ✅ Fine hai — lekin Free project 7 din inactive rehne pe auto-pause ho sakta hai |

> [!WARNING]
> Supabase Free plan pe project **7 days inactivity pe pause** ho jaata hai. Backend down hone se Supabase bhi inactive ho sakta hai — uthate waqt dhyan rakhna.

---

## 📧 4. Email Service — **Resend**
| | Detail |
|---|---|
| **Kya karta hai** | Email OTP bhejna (verification), staff invite emails, dealer notifications |
| **Current Plan** | **Free** — 3,000 emails/month, 100/day limit |
| **Next Plan** | **Pro — \$20/month** (50,000 emails/month) |
| **Upgrade kab zaruri** | Jab daily 100+ emails bhejne pad rahe hon (high dealer signup volume) |
| **Abhi koi issue** | ✅ Fine hai |

---

## 💬 5. WhatsApp OTP — **Meta WhatsApp Cloud API**
| | Detail |
|---|---|
| **Kya karta hai** | Phone OTP bhejta hai WhatsApp pe login ke liye (primary OTP channel) |
| **Current Plan** | **Free** — 1,000 free conversations/month |
| **Next Plan** | Conversation-based billing — ~₹0.50–₹1.50 per conversation (India) |
| **Upgrade kab zaruri** | 1,000+ monthly OTP sessions pe automatic paid ho jaata hai |
| **Abhi koi issue** | ✅ Fine hai — lekin backend down hai to OTPs bhi nahi ja rahe |

---

## 🔐 6. Google OAuth — **Google Cloud Console**
| | Detail |
|---|---|
| **Kya karta hai** | "Login with Google" — dealer aur customer accounts ke liye |
| **Current Plan** | **Free** — Google OAuth is always free |
| **Next Plan** | N/A |
| **Upgrade kab zaruri** | Kabhi nahi (OAuth always free hai) |
| **Abhi koi issue** | ✅ Fine hai |

---

## 🏪 7. Product Catalogue — **Zoho Commerce (Store)**
| | Detail |
|---|---|
| **Kya karta hai** | Live product catalogue, pricing, categories, pricebook (dealer wholesale rates) |
| **Current Plan** | **Paid Zoho plan** (existing subscription) |
| **Next Plan** | Zoho ke saath deal pe depend karta hai |
| **Upgrade kab zaruri** | N/A — already paid hai |
| **Abhi koi issue** | ✅ Fine hai — lekin backend proxy down hai to products bhi nahi dikhenge |

---

## 👥 8. CRM — **Zoho CRM**
| | Detail |
|---|---|
| **Kya karta hai** | Dealer Accounts, Contacts, approval flow, webhook on deal status change |
| **Current Plan** | **Paid Zoho plan** (existing subscription) |
| **Next Plan** | N/A — already paid hai |
| **Upgrade kab zaruri** | N/A |
| **Abhi koi issue** | ✅ Fine hai — lekin backend ka crmPoll job band hai (server down) |

---

## 📊 Summary — Priority Order

| Priority | Service | Status | Action |
|----------|---------|--------|--------|
| 🔴 **P0** | **Render Backend** | **DOWN** | **Upgrade to Starter (\$7/mo) — ABHI** |
| 🟡 P1 | Supabase DB | OK | Watch for 7-day pause; upgrade at \$25/mo when needed |
| 🟢 P2 | Vercel Frontend | OK | Fine for now |
| 🟢 P3 | Resend Email | OK | Fine for now |
| 🟢 P4 | WhatsApp OTP | OK | Will auto-bill after 1,000 convos |
| 🟢 — | Google OAuth | OK | Always free |
| 🟢 — | Zoho Commerce | OK | Already paid |
| 🟢 — | Zoho CRM | OK | Already paid |

---

## 💰 Current Monthly Cost (Approx)

| Service | Cost |
|---------|------|
| Render Free | \$0 (SUSPENDED) |
| Vercel Hobby | \$0 |
| Supabase Free | \$0 |
| Resend Free | \$0 |
| WhatsApp | \$0 (under 1k convos) |
| **Total** | **\$0/month** |

## 💰 After Fixing (Render Starter upgrade)

| Service | Cost |
|---------|------|
| **Render Starter** | **\$7/month (~₹580)** |
| Vercel Hobby | \$0 |
| Supabase Free | \$0 |
| Resend Free | \$0 |
| WhatsApp | \$0 |
| **Total** | **~₹580/month** |
