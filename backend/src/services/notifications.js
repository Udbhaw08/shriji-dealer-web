import { sql } from '../db/pool.js';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/**
 * Dispatch an OTP code via Phone (WhatsApp / SMS) or Email.
 * In development or when external keys are not set, prints prominently to console.
 */
export async function sendOtpNotification({ phone, email, code }) {
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  // 1. Always log prominent OTP in development / server logs for testing
  log.info(`\n============================================================\n🔑 [OTP DISPATCH] Destination: ${cleanPhone || cleanEmail}\n👉 VERIFICATION CODE: ${code}\n⏰ Valid for 10 minutes\n============================================================\n`);

  // 2. Deliver via Phone (WhatsApp Cloud API / Fast2SMS / Twilio)
  if (cleanPhone) {
    let sent = false;

    // Dynamically pick up latest .env variables (e.g. freshly generated Meta token)
    dotenv.config({ override: true });
    const waToken = process.env.WHATSAPP_TOKEN || env.whatsapp.token;
    const waPhoneId = process.env.WHATSAPP_PHONE_ID || env.whatsapp.phoneId;
    const waTemplate = process.env.WHATSAPP_TEMPLATE_NAME || env.whatsapp.templateName;
    const waLang = process.env.WHATSAPP_TEMPLATE_LANG || env.whatsapp.templateLang || 'en_US';

    // A. WhatsApp Cloud API (Meta Official — 1,000 free conversations/month)
    if (waToken && waPhoneId) {
      try {
        let formattedPhone = cleanPhone.replace(/\D/g, ''); // strip non-digits
        if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`; // auto-prefix India code if 10-digit

        const sendWaMessage = async (components) => {
          const payload = waTemplate
            ? {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: {
                  name: waTemplate,
                  language: { code: waLang },
                  ...(components ? { components } : {}),
                },
              }
            : {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'text',
                text: { body: `Your Shriji Dealer Portal verification code is: ${code}. Valid for 10 minutes.` },
              };

          return fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${waToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        };

        let initialComponents;
        if (waTemplate === 'hello_world') {
          initialComponents = undefined;
        } else if (waTemplate === 'otp') {
          initialComponents = [
            {
              type: 'body',
              parameters: [{ type: 'text', text: String(code) }],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: 0,
              parameters: [{ type: 'text', text: String(code) }],
            },
          ];
        } else if (waTemplate) {
          initialComponents = [
            {
              type: 'body',
              parameters: [{ type: 'text', text: String(code) }],
            },
          ];
        }

        let res = await sendWaMessage(initialComponents);
        if (!res.ok && waTemplate) {
          const errText = await res.text();
          // If template requires button parameters (Meta Authentication Template with Copy Code button)
          if (errText.includes('button')) {
            log.info('[notify:whatsapp] Retrying with Authentication button payload format...');
            const authComponents = [
              {
                type: 'body',
                parameters: [{ type: 'text', text: String(code) }],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: String(code) }],
              },
            ];
            res = await sendWaMessage(authComponents);
          } else if (errText.includes('does not accept') || errText.includes('parameter')) {
            log.info('[notify:whatsapp] Retrying with Body-only payload format...');
            const bodyOnly = [
              {
                type: 'body',
                parameters: [{ type: 'text', text: String(code) }],
              },
            ];
            res = await sendWaMessage(bodyOnly);
          } else {
            log.warn(`[notify:whatsapp] WhatsApp send failed (${res.status}): ${errText}`);
          }
        }

        if (res.ok) {
          log.info(`[notify:whatsapp] OTP template sent successfully to ${cleanPhone}`);
          sent = true;
        } else if (!sent) {
          const err = await res.text().catch(() => '');
          log.warn(`[notify:whatsapp] WhatsApp final send failed (${res.status}): ${err}`);
        }

        // Fallback: If template failed and user interacted within 24h, send direct text message
        if (!sent) {
          try {
            const textRes = await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${waToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'text',
                text: { body: `🔐 Your Shriji Dealer Portal verification code is: ${code}. Valid for 10 minutes.` },
              }),
            });
            if (textRes.ok) {
              log.info(`[notify:whatsapp] Direct text OTP delivered to ${formattedPhone}`);
              sent = true;
            }
          } catch (textErr) {
            log.warn(`[notify:whatsapp] direct text fallback error: ${textErr.message}`);
          }
        }
      } catch (err) {
        log.warn(`[notify:whatsapp] error sending via WhatsApp: ${err.message}`);
      }
    }

    // B. Fast2SMS (Indian SMS Gateway)
    if (!sent && env.fast2smsApiKey) {
      try {
        const numbers = cleanPhone.replace(/\D/g, '').slice(-10); // 10-digit Indian number
        const res = await fetch(
          `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(env.fast2smsApiKey)}&variables_values=${encodeURIComponent(code)}&route=otp&numbers=${encodeURIComponent(numbers)}`
        );
        const data = await res.json();
        if (data.return) {
          log.info(`[notify:sms] OTP sent via Fast2SMS to ${numbers}`);
          sent = true;
        } else {
          log.warn(`[notify:sms] Fast2SMS error:`, data.message);
        }
      } catch (err) {
        log.warn(`[notify:sms] Fast2SMS network error: ${err.message}`);
      }
    }

    // C. Twilio (Fallback)
    if (!sent && env.twilio.accountSid && env.twilio.authToken && env.twilio.from) {
      try {
        const auth = Buffer.from(`${env.twilio.accountSid}:${env.twilio.authToken}`).toString('base64');
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: cleanPhone,
              From: env.twilio.from,
              Body: `Your Shriji verification code is: ${code}`,
            }),
          }
        );
        if (res.ok) {
          log.info(`[notify:twilio] OTP sent via Twilio to ${cleanPhone}`);
          sent = true;
        }
      } catch (err) {
        log.warn(`[notify:twilio] Twilio error: ${err.message}`);
      }
    }

    if (!sent) {
      log.info(`[notify:phone] No live SMS/WhatsApp provider configured or active — check console OTP above for ${cleanPhone}`);
    }
  }

  // 3. Deliver via Email (Resend)
  if (cleanEmail && resend) {
    try {
      await resend.emails.send({
        from: 'Shriji Dealer Portal <onboarding@resend.dev>',
        to: cleanEmail,
        subject: 'Your Shriji Dealer Portal OTP Code',
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
      });
      log.info(`[notify:email] Email OTP sent successfully to ${cleanEmail}`);
    } catch (err) {
      log.warn(`[notify:email] Resend delivery notice for ${cleanEmail}: ${err.message} (see terminal OTP above)`);
    }
  }
}

/**
 * Legacy notification helper for user-targeted emails / events.
 */
export async function notify(userId, channel, template, data = {}) {
  const rows = await sql`select email, phone from users where id = ${userId}`;
  const user = rows[0];
  if (!user) {
    log.warn(`[notify] user ${userId} not found for ${template}`);
    return;
  }

  if (template === 'otp_code') {
    return sendOtpNotification({ phone: user.phone, email: user.email, code: data.code });
  }

  log.info(`[notify:${channel}] → ${template} to=${channel === 'email' ? user.email : user.phone}`, data);

  if (channel === 'email' && resend && user.email) {
    let subject = 'Shriji Dealer Portal Notification';
    let html = '<p>You have a new notification.</p>';
    if (template === 'staff_pending_approval') {
      subject = 'New Staff Account Pending Approval';
      html = `<p>A new staff member (${data.staffEmail}) has registered under your store and is waiting for your approval in the Dealer Dashboard.</p>`;
    }

    try {
      await resend.emails.send({
        from: 'Shriji Dealer Portal <onboarding@resend.dev>',
        to: user.email,
        subject,
        html,
      });
      log.info(`[notify:email] Notification sent via Resend to ${user.email}`);
    } catch (err) {
      log.warn(`[notify:email] Resend delivery error to ${user.email}:`, err.message);
    }
  }
}
