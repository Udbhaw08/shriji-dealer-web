import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const API_BASE = Capacitor.isNativePlatform()
  ? (import.meta.env?.VITE_API_URL || "https://restor.in")
  : "";

export function apiUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

/**
 * Universal API fetch that uses Capacitor native HTTP on Android/iOS,
 * completely bypassing WebView CORS, origin blocks, and WebKit restrictions.
 */
export async function apiFetch(path, options = {}) {
  const url = apiUrl(path);
  const method = (options.method || "GET").toUpperCase();
  const headers = options.headers || {};

  if (Capacitor.isNativePlatform()) {
    try {
      let data = undefined;
      if (options.body) {
        try {
          data = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
        } catch {
          data = options.body;
        }
      }

      const res = await CapacitorHttp.request({
        url,
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        data,
      });

      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        statusText: res.status === 200 ? "OK" : `Status ${res.status}`,
        json: async () => res.data,
        text: async () => (typeof res.data === "string" ? res.data : JSON.stringify(res.data)),
      };
    } catch (err) {
      console.warn("[apiFetch] CapacitorHttp error, falling back to window.fetch:", err);
    }
  }

  return fetch(url, options);
}
