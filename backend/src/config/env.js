import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to cwd .env if any

const num = (v, d) => (v != null && v !== '' ? Number(v) : d);
const bool = (v, d) => (v != null && v !== '' ? v === 'true' : d);
const requestedOtpDeliveryMode = (process.env.OTP_DELIVERY_MODE || 'sms').trim().toLowerCase();
const otpDeliveryMode = ['sms', 'whatsapp_then_sms'].includes(requestedOtpDeliveryMode)
  ? requestedOtpDeliveryMode
  : 'sms';

if (requestedOtpDeliveryMode !== otpDeliveryMode) {
  console.warn(`[config] Unsupported OTP_DELIVERY_MODE "${requestedOtpDeliveryMode}"; defaulting to SMS-only.`);
}

export const env = {
  port: num(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  enableJobs: bool(process.env.ENABLE_JOBS, true),
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  firebaseApiKey: process.env.FIREBASE_API_KEY || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  otpDeliveryMode,

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneId: process.env.WHATSAPP_PHONE_ID || '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || '',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'en_US',
  },
  fast2smsApiKey: process.env.FAST2SMS_API_KEY || '',
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM_NUMBER || '',
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
  console.error('[config] DATABASE_URL is required (backend/.env)');
}
if (!env.jwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[config] JWT_SECRET is required in production');
  } else {
    console.warn('[config] JWT_SECRET not set — using a per-process dev secret (tokens reset on restart)');
    env.jwtSecret = `dev-${Math.random().toString(36).slice(2)}`;
  }
}
