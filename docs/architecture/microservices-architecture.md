# Microservices Decoupled Architecture

## Overview
The ReSTOR platform decouples the client-side SPA from heavy CRM integrations via an edge API proxy:
1. **Frontend Client**: React SPA compiled with Vite and bundled with Capacitor for native mobile delivery.
2. **Serverless Edge Layer**: Vercel serverless routes (`/api/products`, `/api/auth`) providing low-latency caching.
3. **Dedicated Node Backend**: Express service handling Supabase PostgreSQL access, Zoho CRM sync, and OTP delivery.
