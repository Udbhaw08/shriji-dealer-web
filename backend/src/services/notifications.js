import { sql } from '../db/pool.js';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import { normalizePhone } from '../utils/phone.js';
import { isValidPhone } from '../utils/validators.js';
import { Resend } from 'resend';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL || 'Shriji Dealer Portal <auth@restor.in>';

/**
 * Dispatch an OTP via Meta WhatsApp Cloud API using an approved Authentication template.
 *
 * Requirements:
 * - Does not downgrade to free-form text or hello_world.
 * - Does not guess template components on failure.
 * - Returns success ONLY after Meta accepts the message and returns a message ID.
 * - Redacts OTPs, tokens, and recipient digits in logs.
 */
export async function sendWhatsAppOtp({ phone, code }) {
  const cleanPhone = phone ? String(phone).trim() : '';
  const norm = normalizePhone(cleanPhone);
  if (!isValidPhone(cleanPhone) || !norm.nationalNumber) {
    throw Object.assign(new Error('Please enter a valid 10-digit Indian mobile number'), { statusCode: 400 });
  }

  const { token, phoneId, templateName, templateLang, graphApiVersion, templateHasButton } = env.whatsapp || {};

  if (!token || !phoneId) {
    log.error('[notify:whatsapp] WhatsApp Cloud API credentials missing (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID)');
    throw Object.assign(new Error('WhatsApp messaging service is not configured. Please ensure WHATSAPP_TOKEN is configured in Vercel.'), {
      statusCode: 503,
      publicMessage: 'WhatsApp messaging service is not configured. Please ensure WHATSAPP_TOKEN is configured in Vercel.',
    });
  }

  // Meta recipient phone format: country code without leading '+' e.g. 919876543210
  const recipientPhone = `91${norm.nationalNumber}`;
  const tName = templateName || 'otp_template';
  const tLang = templateLang || 'en';
  const version = graphApiVersion || 'v21.0';

  const components = [
    {
      type: 'body',
      parameters: [{ type: 'text', text: String(code) }],
    },
  ];

  if (templateHasButton !== false) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(code) }],
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: recipientPhone,
    type: 'template',
    template: {
      name: tName,
      language: { code: tLang },
      components,
    },
  };

  const endpoint = `https://graph.facebook.com/${version}/${phoneId}/messages`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    log.error('[notify:whatsapp] Network error communicating with Meta Graph API:', netErr.message);
    throw Object.assign(new Error('Unable to reach WhatsApp messaging server. Please try again.'), { statusCode: 502 });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.messages?.[0]?.id) {
    const status = response.status;
    const errorCode = data?.error?.code;
    const errorSubcode = data?.error?.error_subcode;
    const errorMessage = data?.error?.message || 'Unknown error';

    log.warn(`[notify:whatsapp] Meta API rejected message (HTTP ${status}, code: ${errorCode || 'none'}, subcode: ${errorSubcode || 'none'}): ${errorMessage}`);

    let userMsg = 'Could not deliver WhatsApp verification code. Please check your number or try again later.';
    if (errorCode === 131030) {
      userMsg = 'This phone number is not permitted in sandbox testing or not registered on WhatsApp.';
    } else if (errorCode === 132001) {
      userMsg = 'WhatsApp message template is unavailable or undergoing review.';
    } else if (errorCode === 190) {
      userMsg = 'WhatsApp service authorization is invalid or expired. Please contact support.';
    }

    throw Object.assign(new Error(userMsg), {
      statusCode: 502,
      metaCode: errorCode,
      publicMessage: userMsg,
    });
  }

  const messageId = data.messages[0].id;
  log.info(`[notify:whatsapp] Meta accepted OTP message for destination 91******${norm.nationalNumber.slice(-4)} (wamid: ${messageId})`);

  return {
    provider: 'whatsapp',
    accepted: true,
    messageId,
  };
}

/**
 * Universal OTP notification dispatcher.
 */
export async function sendOtpNotification({ phone, email, code }) {
  if (phone) {
    return sendWhatsAppOtp({ phone, code });
  }
  if (email) {
    return sendEmailOtp({ email, code });
  }
  throw Object.assign(new Error('Either phone or email destination is required for OTP delivery'), { statusCode: 400 });
}

export async function sendEmailOtp({ email, code }) {
  if (!resend) throw new Error('Email OTP is not configured. Set RESEND_API_KEY.');
  
  let result;
  try {
    result = await resend.emails.send({
      from: SENDER_EMAIL,
      to: email,
      subject: 'Your Shriji Dealer Portal verification code',
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
    });
    if (result.error) {
      throw new Error(result.error.message || 'Resend delivery error');
    }
    log.info(`[notify:email] Email OTP sent successfully to ${email} via ${SENDER_EMAIL}`);
    return { provider: 'email', accepted: true };
  } catch (error) {
    const msg = error?.message || '';
    log.warn(`[notify:email] Resend delivery failed for ${email} with sender ${SENDER_EMAIL}: ${msg}`);
    
    // Fallback: If custom sender fails (e.g. pending DNS), try onboarding@resend.dev
    if (SENDER_EMAIL !== 'Shriji Dealer Portal <onboarding@resend.dev>') {
      try {
        const fbResult = await resend.emails.send({
          from: 'Shriji Dealer Portal <onboarding@resend.dev>',
          to: email,
          subject: 'Your Shriji Dealer Portal verification code',
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
        });
        if (!fbResult.error) {
          log.info(`[notify:email] Email OTP sent successfully to ${email} via fallback sandbox sender`);
          return { provider: 'email', accepted: true };
        }
      } catch (fbErr) {
        log.warn(`[notify:email] Fallback sender also rejected: ${fbErr.message}`);
      }
    }

    if (msg.includes('only send testing emails to your own email address') || msg.includes('resend.com/domains') || error?.statusCode === 403) {
      if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_OTP === 'true') {
        return { provider: 'email', accepted: true, dev_code: code, sandbox_restricted: true };
      }
      throw new Error('Email delivery restricted: DNS verification in progress. For testing, use the account owner email.');
    }
    throw new Error('Could not send the email verification code. Please retry.');
  }
}

export async function notify(userId, channel, template, data = {}) {
  const rows = await sql`select email from users where id = ${userId}`;
  const user = rows[0];
  if (!user) return log.warn(`[notify] user ${userId} not found for ${template}`);
  if (channel !== 'email' || !resend || !user.email) return;
  const subject = template === 'staff_pending_approval' ? 'New Staff Account Pending Approval' : 'Shriji Dealer Portal Notification';
  const html = template === 'staff_pending_approval'
    ? `<p>A new staff member (${data.staffEmail}) is waiting for your approval in the Dealer Dashboard.</p>`
    : '<p>You have a new notification.</p>';
  try {
    await resend.emails.send({ from: SENDER_EMAIL, to: user.email, subject, html });
  } catch (error) {
    log.warn(`[notify:email] Delivery error to ${user.email}: ${error.message}`);
  }
}
