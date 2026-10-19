import { sql } from '../db/pool.js';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import { Resend } from 'resend';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/**
 * Dispatch an OTP code via Phone (WhatsApp / SMS) or Email.
 * Never logs OTP values. Provider acceptance is not confirmed handset delivery.
 */
export async function sendOtpNotification({ phone, email, code }) {
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;
  const providers = [];

  // 2. Deliver via Phone (WhatsApp Cloud API / Fast2SMS / Twilio)
  if (cleanPhone) {
    let sent = false;
    let phoneProvider = null;

    // Provider configuration is loaded once by backend/src/config/env.js.
    const waToken = env.whatsapp.token;
    const waPhoneId = env.whatsapp.phoneId;
    const waTemplate = env.whatsapp.templateName;
    const waLang = env.whatsapp.templateLang || 'en_US';

    // A. WhatsApp Cloud API (Meta Official — 1,000 free conversations/month)
    if (waToken && waPhoneId && waTemplate && waTemplate !== 'hello_world') {
      try {
        let formattedPhone = cleanPhone.replace(/\D/g, ''); // strip non-digits
        if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`; // auto-prefix India code if 10-digit

        const sendWaMessage = async (components) => {
          const payload = {
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'template',
            template: {
              name: waTemplate,
              language: { code: waLang },
              ...(components ? { components } : {}),
            },
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

        // Meta authentication templates require the OTP in the body and OTP button parameters.
        // Use the configured approved Authentication template; never downgrade to free-form text.
        const components = [
          {
            type: 'body',
            parameters: [{ type: 'text', text: String(code) }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: String(code) }],
          },
        ];
        const response = await sendWaMessage(components);
        const responseData = await response.json().catch(() => null);
        if (response.ok && responseData?.messages?.[0]?.id) {
          const messageId = responseData.messages[0].id;
          log.info(`[notify:whatsapp] Meta accepted OTP message (id: ${messageId})`);
          sent = true;
          phoneProvider = 'whatsapp';
        } else {
          const providerMessage = responseData?.error?.message || 'No message ID returned';
          log.warn(`[notify:whatsapp] OTP template request rejected (HTTP ${response.status}): ${providerMessage}`);
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
          phoneProvider = 'fast2sms';
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
          phoneProvider = 'twilio';
        }
      } catch (err) {
        log.warn(`[notify:twilio] Twilio error: ${err.message}`);
      }
    }

    if (!sent) {
      log.warn('[notify:phone] No configured SMS or WhatsApp provider accepted the OTP request');
      throw new Error('No configured SMS or WhatsApp provider accepted the OTP request');
    }
    providers.push(phoneProvider);
  }

  // 3. Deliver via Email (Resend)
  if (cleanEmail) {
    if (!resend) throw new Error('Email OTP provider is not configured');
    try {
      const result = await resend.emails.send({
        from: 'Shriji Dealer Portal <onboarding@resend.dev>',
        to: cleanEmail,
        subject: 'Your Shriji Dealer Portal OTP Code',
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
      });
      if (result?.error) throw new Error(result.error.message || 'Resend rejected the email');
      log.info(`[notify:email] Resend accepted OTP email for ${cleanEmail}`);
      providers.push('resend');
    } catch (err) {
      log.warn(`[notify:email] OTP provider failed for ${cleanEmail}: ${err.message}`);
      throw new Error('Email provider rejected the OTP request');
    }
  }
  return { providers };
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
