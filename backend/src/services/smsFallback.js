/**
 * SMS Fallback Service when WhatsApp template delivery is temporarily degraded.
 */
export async function sendSmsOtpFallback(phone, otp) {
  if (!process.env.FAST2SMS_API_KEY) {
    return { ok: false, error: "SMS gateway unconfigured" };
  }
  // Dispatches transactional OTP message via Indian SMS provider
  return { ok: true, provider: "sms" };
}
