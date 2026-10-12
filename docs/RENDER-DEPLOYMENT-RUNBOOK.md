# Shriji Dealer Backend — Render Deployment Runbook

Complete step-by-step guide to hosting `backend/` on **Render** (https://render.com).

---

## 1. Summary of Changes Made to Prepare the Codebase

All necessary configurations and optimizations for Render are already implemented in your codebase:
1. **`render.yaml` created**: Infrastructure-as-Code Blueprint configured with `rootDir: backend`, Singapore region (closest to India), Node runtime, and full environment variable schema.
2. **`backend/src/server.js` enhanced**:
   - Explicit binding to `0.0.0.0` (required for containerized environments).
   - Production CORS setup with `restor.in` and preview wildcards (`*.vercel.app`).
   - Root endpoint `GET /` returning service health status (`status: online`).
   - Graceful shutdown listeners for `SIGTERM`/`SIGINT` ensuring clean teardown of HTTP server and Supabase connection pool.
3. **`.node-version` (v20)**: Added at root and inside `backend/` so Render automatically selects Node.js 20 LTS.
4. **`backend/package.json`**: Added `"build"` script (`process.exit(0)`) so build steps complete without error, plus `"check:ready"`.
5. **`android/app/src/main/res/xml/network_security_config.xml`**: Whitelisted `onrender.com` for Android apps.
6. **`backend/.env.example`**: Fully synchronized with all production keys.

---

## 2. Choosing Your Deployment Method

You can deploy using either of two methods:

### Method A: One-Click Render Blueprint (Recommended)
1. Go to **[dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** at the top right → Select **Blueprint**.
3. Connect your repository: `Udbhaw08/shriji-dealer-web`.
4. Render will detect `render.yaml` in the root!
5. It will automatically populate:
   - Name: `shriji-backend`
   - Root Directory: `backend`
   - Region: `Singapore`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health Check Path: `/health`
6. Fill in the prompted secret variables (paste from your `backend/.env`).
7. Click **Apply**. Render will build, migrate, and start the service!

---

### Method B: Manual Web Service Setup (Step-by-Step)
If you prefer creating a Web Service manually:
1. In Render Dashboard, click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** → Select `shriji-dealer-web`.
3. Configure these exact settings:

| Setting | Value | Why |
|---|---|---|
| **Name** | `shriji-backend` (or your choice) | Gives URL: `https://<name>.onrender.com` |
| **Region** | **Singapore** | Closest to AWS Mumbai (`ap-south-1` Supabase) & Zoho India (`.in`) |
| **Branch** | `feature/backend-auth-testing` | Active working branch |
| **Root Directory** | **`backend`** | **CRITICAL**: The backend lives in `backend/` subfolder |
| **Runtime** | **Node** | Node.js 20 LTS |
| **Build Command** | `npm install` | Installs dependencies |
| **Start Command** | `npm start` | Runs `node src/server.js` |
| **Instance Type / Plan**| **Starter** ($7/mo) or **Free** | *See note below on Free vs Starter* |

4. Scroll down to **Advanced** → **Health Check Path**:
   - Set to: `/health`
5. In the **Environment Variables** section:
   - Click **Add from .env** or paste the variables from `backend/.env`.

---

## 3. Environment Variables Reference

Copy the exact values from your local `backend/.env` file:

```env
NODE_ENV=production
ENABLE_JOBS=true
CRM_POLL_MINUTES=5
CATALOG_TTL_MINUTES=60
FRONTEND_ORIGINS=https://restor.in,https://www.restor.in,http://localhost:5173

# Database (Supabase Mumbai)
DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

# Auth
JWT_SECRET=[Your JWT secret from backend/.env]

# Zoho Integration
ZOHO_DC=in
ZOHO_CRM_CLIENT_ID=[Your CRM Client ID]
ZOHO_CRM_CLIENT_SECRET=[Your CRM Client Secret]
ZOHO_CRM_REFRESH_TOKEN=[Your CRM Refresh Token]
ZOHO_CRM_ORG_ID=[Your CRM Org ID]

ZOHO_CLIENT_ID=[Your Commerce Client ID]
ZOHO_CLIENT_SECRET=[Your Commerce Client Secret]
ZOHO_REFRESH_TOKEN=[Your Commerce Refresh Token]
ZOHO_ORG_ID=[Your Commerce Org ID]
ZOHO_DEALER_PRICEBOOK_ID=3334672000000547177

# Webhook Secret (Shared with Zoho CRM workflow)
WEBHOOK_SECRET=[Your Webhook Secret]

# Notifications & Social Auth
RESEND_API_KEY=[Your Resend API Key]
GOOGLE_CLIENT_ID=[Your Google Client ID]
GOOGLE_CLIENT_SECRET=[Your Google Client Secret]
FIREBASE_PROJECT_ID=[Your Firebase Project ID]
FIREBASE_API_KEY=[Your Firebase API Key]
WHATSAPP_TOKEN=[Your WhatsApp Token]
WHATSAPP_PHONE_ID=[Your WhatsApp Phone ID]
WHATSAPP_TEMPLATE_NAME=[Your WhatsApp Template Name]
```

> **Note on PORT**: Do NOT manually set `PORT=8080` in Render. Render automatically assigns `$PORT` (typically `10000`), which `src/config/env.js` reads dynamically.

---

## 4. Free vs. Starter Plan Note

- **Starter Plan ($7/month)** *(Recommended)*:
  Stays running 24/7. Background cron jobs (`crmPoll` every 5 min for automatic dealer approvals and `catalogSync` every 60 min for fresh product cache) run uninterrupted without spinning down.
- **Free Plan**:
  Render puts free services to sleep after 15 minutes of inactivity. When a user requests the app, there is a ~45s cold start. While asleep, background polling pauses. (You can still use Free for initial testing, or use a free ping monitor like UptimeRobot to ping `/health` every 10 minutes to prevent sleep).

---

## 5. Connecting Frontend to the Live Backend

Once your Render deployment completes, Render will show your URL:
`https://shriji-dealer-web.onrender.com` (or your chosen service name).

### 1. In Vercel (or production frontend host):
Add this Environment Variable in your Vercel Project Settings:
```
VITE_AUTH_API_URL=https://shriji-dealer-web.onrender.com
```
Then trigger a redeploy of the frontend on Vercel.

### 2. In Local `.env.local` (for testing):
```
VITE_AUTH_API_URL=https://shriji-dealer-web.onrender.com
```

### 3. In Zoho CRM Workflow (Dealer Approval Webhook):
Set the Webhook URL to:
```
https://shriji-dealer-web.onrender.com/webhooks/crm/approval
```
With Header:
```
X-Webhook-Secret: <your WEBHOOK_SECRET>
```

---

## 6. How to Verify After Deployment

1. **Check Root Endpoint**:
   Open in your browser:
   `https://shriji-dealer-web.onrender.com/`
   Expected response:
   ```json
   {
     "service": "shriji-backend",
     "status": "online",
     "version": "0.1.0",
     "health": "/health"
   }
   ```

2. **Check Database & Jobs Health**:
   Open:
   `https://shriji-dealer-web.onrender.com/health`
   Expected response:
   ```json
   {
     "ok": true,
     "db": "up",
     "crm_configured": true,
     "commerce_configured": true,
     "last_crm_poll_at": "...",
     "uptime_seconds": 12
   }
   ```

3. **Check Live Logs in Render Dashboard**:
   Look for:
   ```
   [migrate] up to date
   [jobs] crmPoll every 5 min
   [jobs] catalogSync every 60 min
   [server] listening on :10000
   [catalog] synced 437 products
   ```
