import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to cwd .env if any

const num = (v, d) => (v != null && v !== '' ? Number(v) : d);
const bool = (v, d) => (v != null && v !== '' ? v === 'true' : d);

export const env = {
  port: num(process.env.PORT, 8080),
  databaseUrl:
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    '',
  jwtSecret: process.env.JWT_SECRET || '',
  enableJobs: bool(process.env.ENABLE_JOBS, true),
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  get otpRateLimitMax() { return num(process.env.OTP_RATE_LIMIT_MAX, 20); },
  get otpRateLimitWindowMs() { return num(process.env.OTP_RATE_LIMIT_WINDOW_MS, 3 * 60_000); },
  get authStrictRateLimitMax() { return num(process.env.AUTH_STRICT_RATE_LIMIT_MAX, 30); },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneId: process.env.WHATSAPP_PHONE_ID || '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'otp',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US',
    graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v21.0',
    templateHasButton: process.env.WHATSAPP_TEMPLATE_HAS_BUTTON !== 'false',
  },

  zoho: {
    dc: process.env.ZOHO_DC || 'in',
    crm: {
      clientId: process.env.ZOHO_CRM_CLIENT_ID || '',
      clientSecret: process.env.ZOHO_CRM_CLIENT_SECRET || '',
      refreshToken: process.env.ZOHO_CRM_REFRESH_TOKEN || '',
      orgId: process.env.ZOHO_CRM_ORG_ID || '',
    },
    commerce: {
      clientId: process.env.ZOHO_CLIENT_ID || '',
      clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
      refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
      orgId: process.env.ZOHO_ORG_ID || '',
      dealerPricebookId: process.env.ZOHO_DEALER_PRICEBOOK_ID || '3334672000000547177',
    },
  },

  catalogTtlMinutes: num(process.env.CATALOG_TTL_MINUTES, 60),
  crmPollMinutes: num(process.env.CRM_POLL_MINUTES, 5),
};

if (!env.databaseUrl) {
  console.warn('[config] DATABASE_URL is not set; falling back to safe dummy DB client in serverless mode');
}
if (!env.jwtSecret) {
  const isServerless = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (process.env.NODE_ENV === 'production' && !isServerless) {
    throw new Error('[config] FATAL: JWT_SECRET is required in production environment.');
  } else {
    console.warn('[config] JWT_SECRET not set — using fallback secret');
    env.jwtSecret = process.env.JWT_SECRET || 'dealer-jwt-shriji-default-secret-2026';
  }
}

