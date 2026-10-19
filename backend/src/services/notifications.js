import { sql } from '../db/pool.js';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import { Resend } from 'resend';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/**
 * Dispatch an OTP code via Phone (SMS-only by default, optionally WhatsApp then
 * SMS) or Email. OTP values are never written to logs.
 */
export async function sendOtpNotification({ phone, email, code }) {
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  // SMS-only is the safe default while WhatsApp sender verification is pending.
  if (cleanPhone) {
    const waToken = process.env.WHATSAPP_TOKEN || env.whatsapp.token;
    const waPhoneId = process.env.WHATSAPP_PHONE_ID || env.whatsapp.phoneId;
    const waTemplate = process.env.WHATSAPP_TEMPLATE_NAME || env.whatsapp.templateName;
    const waLang = process.env.WHATSAPP_TEMPLATE_LANG || env.whatsapp.templateLang || 'en_US';
    const smsApiKey = process.env.FAST2SMS_API_KEY || env.fast2smsApiKey;
    const providerErrors = [];
    const whatsappEnabled = env.otpDeliveryMode === 'whatsapp_then_sms';

    if (whatsappEnabled && waToken && waPhoneId && waTemplate) {
      const formattedPhone = cleanPhone.replace(/\D/g, '').length === 10
        ? `91${cleanPhone.replace(/\D/g, '')}`
        : cleanPhone.replace(/\D/g, '');
      const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'template',
        template: {
          name: waTemplate,
          language: { code: waLang },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: String(code) }] },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: String(code) }],
            },
          ],
        },
      };

      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        const response = await res.json().catch(() => ({}));
        if (!res.ok) {
          const metaError = response.error;
          const reason = `Meta HTTP ${res.status}, code ${metaError?.code || 'unknown'}: ${metaError?.message || 'unknown error'}`;
          providerErrors.push(reason);
          log.warn(`[notify:whatsapp] Meta rejected OTP request (${reason})`);
        } else {
          const messageId = response.messages?.[0]?.id;
          if (messageId) {
            log.info(`[notify:whatsapp] Meta accepted OTP message ${messageId}; delivery receipt pending.`);
            return { provider: 'whatsapp', accepted: true, messageId };
          }
          providerErrors.push('Meta did not confirm a WhatsApp message ID.');
        }
      } catch (err) {
        const reason = err.name === 'TimeoutError' ? 'Meta request timed out.' : 'Could not reach Meta WhatsApp API.';
        providerErrors.push(reason);
        log.warn(`[notify:whatsapp] ${reason}`);
      }
    } else if (whatsappEnabled) {
      providerErrors.push('WhatsApp is not fully configured (token, phone ID, and template are required).');
    }

    if (smsApiKey) {
      const digits = cleanPhone.replace(/\D/g, '');
      const localNumber = digits.length > 10 ? digits.slice(-10) : digits;
      if (localNumber.length !== 10) {
        providerErrors.push('Fast2SMS supports Indian 10-digit mobile numbers only.');
      } else {
        try {
          const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
              Authorization: smsApiKey,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              route: 'otp',
              variables_values: String(code),
              numbers: localNumber,
            }),
            signal: AbortSignal.timeout(10_000),
          });
          const response = await res.json().catch(() => ({}));
          if (res.ok && response.return === true) {
            log.info(`[notify:fast2sms] OTP accepted for ${localNumber}; delivery receipt pending.`);
            return { provider: 'sms', accepted: true, requestId: response.request_id || null };
          }
          const reason = response.message || response.msg || `HTTP ${res.status}`;
          providerErrors.push(`Fast2SMS rejected OTP request: ${reason}`);
          log.warn(`[notify:fast2sms] OTP rejected (HTTP ${res.status}): ${reason}`);
        } catch (err) {
          const reason = err.name === 'TimeoutError' ? 'Fast2SMS request timed out.' : 'Could not reach Fast2SMS API.';
          providerErrors.push(reason);
          log.warn(`[notify:fast2sms] ${reason}`);
        }
      }
    } else {
      providerErrors.push('Fast2SMS is not configured (set FAST2SMS_API_KEY).');
    }

    throw new Error(`OTP delivery failed. ${providerErrors.join(' ')}`);
  }

  // Deliver email verification codes via Resend.
  if (cleanEmail && resend) {
    try {
      await resend.emails.send({
        from: 'Shriji Dealer Portal <onboarding@resend.dev>',
        to: cleanEmail,
        subject: 'Your Shriji Dealer Portal OTP Code',
        html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
      });
      log.info(`[notify:email] Email OTP sent successfully to ${cleanEmail}`);
      return { provider: 'email', accepted: true };
    } catch (err) {
      log.warn(`[notify:email] Resend delivery failed for ${cleanEmail}: ${err.message}`);
      throw new Error('Could not send the email verification code. Please retry.');
    }
  }

  throw new Error(cleanEmail
    ? 'Email OTP is not configured. Set RESEND_API_KEY.'
    : 'A phone number or email address is required.');
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
