import { Capacitor } from "@capacitor/core";
import { apiFetch, apiUrl } from "./api";

/* Real authentication client for the backend service (docs/BACKEND-ARCHITECTURE.md).
 *
 * Token rules (non-negotiable):
 *  - Access token: memory only, 15-minute life, re-obtained via refresh.
 *  - Refresh token: Capacitor Preferences on native, sessionStorage on web —
 *    never plain localStorage, so it does not survive long in an XSS-reachable jar.
 *  - Every 401 triggers exactly one refresh attempt, then the request retries.
 */

const AUTH_BASE =
  import.meta.env.VITE_AUTH_API_URL ||
  (import.meta.env.DEV && !Capacitor.isNativePlatform() ? "http://localhost:8080" : apiUrl(""));

const PREFS_KEY = "shriji.auth.tokens";

let accessToken = null;
let currentRefreshToken = null;
let refreshPromise = null;

function prefsStore() {
  return {
    async get() {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Preferences } = await import("@capacitor/preferences");
          return (await Preferences.get({ key: PREFS_KEY })).value;
        } catch {
          return null;
        }
      }
      try {
        return sessionStorage.getItem(PREFS_KEY);
      } catch {
        return null;
      }
    },
    async set(value) {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Preferences } = await import("@capacitor/preferences");
          await Preferences.set({ key: PREFS_KEY, value });
        } catch {
          /* storage unavailable — session is memory-only */
        }
        return;
      }
      try {
        if (value === null) sessionStorage.removeItem(PREFS_KEY);
        else sessionStorage.setItem(PREFS_KEY, value);
      } catch {
        /* ignore */
      }
    },
  };
}

export async function initTokens() {
  const raw = await prefsStore().get();
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    accessToken = saved.accessToken || null;
    currentRefreshToken = saved.refreshToken || null;
  } catch {
    /* corrupt — ignore */
  }
}

function persistTokens() {
  return prefsStore().set(
    currentRefreshToken ? JSON.stringify({ accessToken, refreshToken: currentRefreshToken }) : null,
  );
}

export function hasSession() {
  return Boolean(accessToken || currentRefreshToken);
}

async function callBackend(path, options = {}, attempt = 0) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await apiFetch(`${AUTH_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && attempt === 0 && currentRefreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) return callBackend(path, options, 1);
  }
  return res;
}

async function tryRefresh() {
  if (!currentRefreshToken) return false;
  refreshPromise ||= (async () => {
    try {
      const res = await apiFetch(`${AUTH_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      accessToken = data.accessToken;
      currentRefreshToken = data.refreshToken;
      await persistTokens();
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function applyAuthResponse(res) {
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Authentication failed");
  }
  if (data.accessToken) {
    accessToken = data.accessToken;
    currentRefreshToken = data.refreshToken || null;
    await persistTokens();
  }
  return data;
}

const json = (body) => ({ method: "POST", body: JSON.stringify(body) });

/* ---- Auth API ---- */

export async function signup({ email, password, phone }) {
  return applyAuthResponse(await callBackend("/api/auth/signup", json({ email, password, phone })));
}

export async function login({ email, password }) {
  return applyAuthResponse(await callBackend("/api/auth/login", json({ email, password })));
}

export async function staffSignup({ email, password, invite_code }) {
  const res = await callBackend("/api/auth/staff/signup", json({ email, password, invite_code }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Staff signup failed");
  return data;
}

export async function requestOtp(payload) {
  const res = await callBackend("/api/auth/otp/request", json(payload));
  if (!res.ok) throw new Error((await res.json()).error || "Could not send OTP");
  return true;
}

export async function verifyOtp(payload) {
  return applyAuthResponse(await callBackend("/api/auth/otp/verify", json(payload)));
}

export async function fetchMe() {
  const res = await callBackend("/api/auth/me");
  if (res.status === 401) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load session");
  return data; // { user, dealer }
}

export async function applyAsDealer(form) {
  const res = await callBackend("/api/dealers/apply", json(form));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not submit application");
  return data;
}

export async function staffInvite() {
  const res = await callBackend("/api/dealers/staff/invite", json({}));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not create invite");
  return data; // { code, expires_at }
}

export async function staffList() {
  const res = await callBackend("/api/dealers/staff");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load staff");
  return data.staff || [];
}

export async function staffApprove(userId) {
  const res = await callBackend(`/api/dealers/staff/${userId}/approve`, json({}));
  if (!res.ok) throw new Error((await res.json()).error || "Approve failed");
}

export async function staffRevoke(userId) {
  const res = await callBackend(`/api/dealers/staff/${userId}/revoke`, json({}));
  if (!res.ok) throw new Error((await res.json()).error || "Revoke failed");
}

export async function logout() {
  try {
    if (currentRefreshToken) {
      await apiFetch(`${AUTH_BASE}/api/auth/logout`, json({ refreshToken: currentRefreshToken }));
    }
  } catch {
    /* best effort — clear locally regardless */
  }
  accessToken = null;
  currentRefreshToken = null;
  await persistTokens();
}

/** Map a backend { user, dealer } response onto the session store shape. */
export function sessionFromAuth(user, dealer) {
  const isDealerSide = user.role === "dealer" || user.role === "dealer_staff";
  const dealerStatus = dealer?.status || (isDealerSide ? "pending" : "approved");
  return {
    role: isDealerSide ? "dealer" : "customer",
    // customer sessions have no approval gate; dealer sessions mirror CRM
    status: isDealerSide ? dealerStatus : "approved",
    dealerId: dealer?.id || null,
    dealer: dealer
      ? {
          id: dealer.id,
          name: dealer.business_name,
          person: null,
          phone: user.phone,
          city: null,
          status: dealerStatus,
          dealer_code: dealer.dealer_code,
        }
      : null,
    email: user.email,
    userId: user.id,
    authRole: user.role, // customer | dealer | dealer_staff — the backend's real role
    staffPending: user.role === "dealer_staff" && user.status === "pending",
  };
}
