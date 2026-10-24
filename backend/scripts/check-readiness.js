import 'dotenv/config';
import postgres from 'postgres';

async function check() {
  console.log('\n--- SHRIJI BACKEND: RENDER DEPLOYMENT READINESS CHECK ---\n');

  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ZOHO_CRM_CLIENT_ID',
    'ZOHO_CRM_CLIENT_SECRET',
    'ZOHO_CRM_REFRESH_TOKEN',
    'ZOHO_CRM_ORG_ID',
    'ZOHO_CLIENT_ID',
    'ZOHO_CLIENT_SECRET',
    'ZOHO_REFRESH_TOKEN',
    'ZOHO_ORG_ID',
  ];

  const optional = [
    'RESEND_API_KEY',
    'WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];

  let missingReq = 0;
  for (const k of required) {
    if (process.env[k]) {
      console.log(`  [OK] ${k} is set`);
    } else {
      console.log(`  [MISSING] ${k} is NOT set!`);
      missingReq++;
    }
  }

  console.log('\nOptional variables check:');
  for (const k of optional) {
    console.log(`  [${process.env[k] ? 'OK' : 'INFO'}] ${k}: ${process.env[k] ? 'configured' : 'not set (optional)'}`);
  }

  if (missingReq > 0) {
    console.error(`\n[ERROR] ${missingReq} required environment variables are missing!`);
    process.exit(1);
  }

  // Database connectivity test
  console.log('\nTesting Supabase Postgres connection...');
  try {
    const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 });
    const [{ now }] = await sql`select now()`;
    const [{ count }] = await sql`select count(*)::int as count from sync_state`;
    await sql.end();
    console.log(`  [OK] Supabase connected successfully (DB Time: ${now}, sync_state entries: ${count})`);
  } catch (err) {
    console.error(`  [FAIL] Supabase connection failed: ${err.message}`);
    process.exit(1);
  }

  console.log('\n>>> ALL CHECKS PASSED: Ready for Render production deployment! <<<\n');
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
