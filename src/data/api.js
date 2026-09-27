import { Capacitor } from "@capacitor/core";

export const API_BASE = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_URL || "https://shrijidomestic.com")
  : "";

export function apiUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}
