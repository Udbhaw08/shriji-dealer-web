import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkStatus() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.error('Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID in backend/.env');
    process.exit(1);
  }
 
  console.log('\n==========================================');
  console.log('   META WHATSAPP PRODUCTION STATUS CHECK');
  console.log('==========================================\n');

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=display_phone_number,verified_name,name_status,status,quality_rating,messaging_limit_tier,health_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    if (!res.ok) {
      console.error('Meta API Error:', data);
      return;
    }

    const health = data.health_status?.entities?.find((e) => e.entity_type === 'PHONE_NUMBER');

    console.log(`📱 Display Number  : ${data.display_phone_number}`);
    console.log(`🏷️  Verified Name   : ${data.verified_name}`);
    console.log(`⏳ Name Status     : ${data.name_status === 'APPROVED' ? 'APPROVED ✅ (Ready for Production)' : data.name_status + ' (Review in progress ⏳)'}`);
    console.log(`📶 Network Status  : ${data.status} ✅`);
    console.log(`⭐ Quality Rating  : ${data.quality_rating}`);
    console.log(`🚀 Limit Tier      : ${data.messaging_limit_tier || 'TIER_250'} (250 conversations/day)`);
    console.log(`📨 Messaging State : ${health?.can_send_message === 'AVAILABLE' ? 'AVAILABLE ✅ (Full Access)' : health?.can_send_message || 'PENDING'}`);

    if (data.name_status === 'APPROVED') {
      console.log('\n🎉 ALL CHECKS PASSED: Your WhatsApp Display Name is Approved!');
      console.log('   You can now create authentication templates and send OTPs to anyone.');
    } else {
      console.log('\n⏳ Meta Automated Review is currently running for name: "' + data.verified_name + '".');
      console.log('   Check back in ~1-2 hours or re-run: node backend/scripts/check-whatsapp-status.js');
    }
    console.log('\n==========================================\n');
  } catch (err) {
    console.error('Network Error:', err.message);
  }
}

checkStatus();
