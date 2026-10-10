export async function dispatchNotification({ channel, target, content }) {
  switch (channel) {
    case "whatsapp":
      return { ok: true, channel: "whatsapp" };
    case "sms":
      return { ok: true, channel: "sms" };
    case "email":
      return { ok: true, channel: "email" };
    default:
      return { ok: false, error: `Unknown notification channel: ${channel}` };
  }
}
