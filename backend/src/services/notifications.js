import { sql } from '../db/pool.js';
import { log } from '../utils/logger.js';
import { env } from '../config/env.js';
import { Resend } from 'resend';

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendEmailOtp({ email, code }) {
  if (!resend) throw new Error('Email OTP is not configured. Set RESEND_API_KEY.');
  try {
    await resend.emails.send({
      from: 'Shriji Dealer Portal <onboarding@resend.dev>',
      to: email,
      subject: 'Your Shriji Dealer Portal verification code',
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code is valid for 10 minutes.</p>`,
    });
    log.info(`[notify:email] Email OTP sent successfully to ${email}`);
    return { provider: 'email', accepted: true };
  } catch (error) {
    log.warn(`[notify:email] Resend delivery failed for ${email}: ${error.message}`);
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
    await resend.emails.send({ from: 'Shriji Dealer Portal <onboarding@resend.dev>', to: user.email, subject, html });
  } catch (error) {
    log.warn(`[notify:email] Delivery error to ${user.email}: ${error.message}`);
  }
}
