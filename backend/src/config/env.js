import 'dotenv/config';

const num = (v, d) => (v != null && v !== '' ? Number(v) : d);
const bool = (v, d) => (v != null && v !== '' ? v === 'true' : d);

export const env = {
  port: num(process.env.PORT, 8080),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  enableJobs: bool(process.env.ENABLE_JOBS, true),
  webhookSecret: process.env.WEBHOOK_SECRET || '',

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
