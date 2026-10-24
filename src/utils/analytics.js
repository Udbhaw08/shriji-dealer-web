export function trackEvent(name, properties = {}) {
  try {
    if (typeof window !== "undefined" && window.va) {
      window.va("event", { name, ...properties });
    }
  } catch {}
}
