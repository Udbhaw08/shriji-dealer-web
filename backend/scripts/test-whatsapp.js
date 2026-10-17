import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Diagnostic and test script for Meta WhatsApp Cloud API integration.
 * Usage:
 *   node backend/scripts/test-whatsapp.js [optional_recipient_phone]
 */
async function testWhatsApp() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US';
  const targetPhone = process.argv[2];

  console.log('\n==========================================');
  console.log('  META WHATSAPP CLOUD API DIAGNOSTIC');
  console.log('==========================================\n');

  console.log('Configuration from backend/.env:');
  console.log('  WHATSAPP_PHONE_ID     :', phoneId || '(NOT SET)');
  console.log('  WHATSAPP_TOKEN        :', token ? `${token.substring(0, 15)}...${token.substring(token.length - 10)}` : '(NOT SET)');
  console.log('  WHATSAPP_TEMPLATE_NAME:', templateName || '(NOT SET - will attempt raw text)');
  console.log('  WHATSAPP_TEMPLATE_LANG:', templateLang);

  if (!token || !phoneId) {
    console.error('\n[FAIL] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID in backend/.env');
    process.exit(1);
  }

  // 1. Verify Token & Phone Number details
  console.log('\nStep 1: Validating Token & Phone ID with Meta Graph API...');
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`\n[FAIL] Meta API returned HTTP ${res.status}:`);
      console.error(JSON.stringify(data, null, 2));
      if (data.error?.code === 190) {
        console.error('\n>>> Token Expired or Invalid! Please generate a new System User Permanent Token or refreshed API token.');
      }
      process.exit(1);
    }
    console.log('[SUCCESS] Connected to Meta Graph API!');
    console.log('  Display Phone Number :', data.display_phone_number);
    console.log('  Verified Name        :', data.verified_name);
    console.log('  Quality Rating       :', data.quality_rating);
    console.log('  Account Mode         :', data.code_verification_status || 'Active');
  } catch (err) {
    console.error('[FAIL] Network error querying Meta API:', err.message);
    process.exit(1);
  }

  // 2. If target phone is provided, attempt sending a test OTP
  if (targetPhone) {
    let cleanPhone = targetPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const testCode = '123456';

    console.log(`\nStep 2: Sending test OTP (${testCode}) to +${cleanPhone}...`);

    async function sendPayload(components) {
      const payload = templateName
        ? {
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: templateLang },
              ...(components ? { components } : {}),
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'text',
            text: { body: `[Test] Your Shriji Dealer Portal verification code is: ${testCode}. Valid for 10 minutes.` },
          };

      return fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    try {
      let initialComponents;
      if (templateName === 'hello_world') {
        initialComponents = undefined;
      } else if (templateName) {
        initialComponents = [
          {
            type: 'body',
            parameters: [{ type: 'text', text: testCode }],
          },
        ];
      }

      let sendRes = await sendPayload(initialComponents);
      let sendData = await sendRes.json();

      // If failed because template requires button parameters (Meta Authentication Template with Copy Code button)
      if (!sendRes.ok && sendData.error?.message?.includes('button') && templateName) {
        console.log('  [Notice] Retrying with Authentication Copy-Code Button payload...');
        const authComponents = [
          {
            type: 'body',
            parameters: [{ type: 'text', text: testCode }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: testCode }],
          },
        ];
        sendRes = await sendPayload(authComponents);
        sendData = await sendRes.json();
      }

      if (sendRes.ok) {
        console.log('\n[SUCCESS] Message sent successfully!');
        console.log('  Message ID:', sendData.messages?.[0]?.id);
      } else {
        console.error(`\n[FAIL] Failed to send message (HTTP ${sendRes.status}):`);
        console.error(JSON.stringify(sendData, null, 2));
        if (sendData.error?.code === 131030) {
          console.error('\n>>> Error #131030: If you are using a Test Phone Number, the recipient number must be added to "To" allowed list in developers.facebook.com WhatsApp -> API Setup.');
        } else if (sendData.error?.code === 131047) {
          console.error('\n>>> Error #131047: Cannot send raw text outside 24h window. You MUST use an approved template.');
        } else if (sendData.error?.code === 132001) {
          console.error(`\n>>> Error #132001: Template "${templateName}" does not exist or has not been approved in language "${templateLang}".`);
        }
      }
    } catch (err) {
      console.error('[FAIL] Network error sending message:', err.message);
    }
  } else {
    console.log('\n[INFO] To send a test OTP message, re-run with your phone number:');
    console.log('  node backend/scripts/test-whatsapp.js 9876543210');
  }

  console.log('\n==========================================\n');
}

testWhatsApp().catch(console.error);
