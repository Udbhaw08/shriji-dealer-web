import { Capacitor } from "@capacitor/core";
import { apiFetch, apiUrl } from "./api.js";

/* Real authentication client for the backend service (docs/BACKEND-ARCHITECTURE.md).
 *
 * Token rules:
 *  - Persistent storage: localStorage on web, Capacitor Preferences on native,
 *    with seamless migration from legacy sessionStorage.
 *  - 30-Day Window: Session is preserved across browser restarts and tab revisits
 *    with a 30-day sliding window (renewed on activity), staying logged in till signout.
 *  - 401 triggers token refresh attempt, maintaining valid sessions seamlessly.
 */

const AUTH_BASE =
  import.meta.env?.VITE_AUTH_API_URL ||
  (import.meta.env?.DEV && !Capacitor.isNativePlatform() ? "http://localhost:8080" : apiUrl(""));

export const PREFS_KEY = "shriji.auth.tokens";
export const SESSION_PROFILE_KEY = "shriji.auth.session_profile";
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000; // 30 days in ms

let accessToken = null;
let currentRefreshToken = null;
let refreshPromise = null;

// Synchronous pre-hydration in browser: eliminates flicker so hasSession() is immediately true
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(PREFS_KEY) || sessionStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const now = Date.now();
      if (!saved.expiresAt || now <= saved.expiresAt) {
        accessToken = saved.accessToken || null;
        currentRefreshToken = saved.refreshToken || null;
      }
    }
  } catch {}
}

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
        const val = localStorage.getItem(PREFS_KEY);
        if (val) return val;
        // Migration: check legacy sessionStorage
        const sessionVal = sessionStorage.getItem(PREFS_KEY);
        if (sessionVal) {
          try {
            localStorage.setItem(PREFS_KEY, sessionVal);
            sessionStorage.removeItem(PREFS_KEY);
          } catch {}
          return sessionVal;
        }
        return null;
      } catch {
        try {
          return sessionStorage.getItem(PREFS_KEY);
        } catch {
          return null;
        }
      }
    },
    async set(value) {
      if (Capacitor.isNativePlatform()) {
        try {
          const { Preferences } = await import("@capacitor/preferences");
          if (value === null) {
            await Preferences.remove({ key: PREFS_KEY });
          } else {
            await Preferences.set({ key: PREFS_KEY, value });
          }
        } catch {}
        return;
      }
      try {
        if (value === null) {
          localStorage.removeItem(PREFS_KEY);
          sessionStorage.removeItem(PREFS_KEY);
        } else {
          localStorage.setItem(PREFS_KEY, value);
          sessionStorage.removeItem(PREFS_KEY);
        }
      } catch {
        try {
          if (value === null) sessionStorage.removeItem(PREFS_KEY);
          else sessionStorage.setItem(PREFS_KEY, value);
        } catch {}
      }
    },
  };
}

export async function initTokens() {
  const raw = await prefsStore().get();
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    const now = Date.now();
    // 30-day window check: expired if inactivity exceeds 30 days
    if (saved.expiresAt && now > saved.expiresAt) {
      accessToken = null;
      currentRefreshToken = null;
      await prefsStore().set(null);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(SESSION_PROFILE_KEY);
          sessionStorage.removeItem(SESSION_PROFILE_KEY);
        } catch {}
      }
      return;
    }
    accessToken = saved.accessToken || null;
    currentRefreshToken = saved.refreshToken || null;

    // Slide 30-day window forward on active revisit (kept logged in till signout)
    if (currentRefreshToken) {
      const refreshedPayload = {
        accessToken,
        refreshToken: currentRefreshToken,
        savedAt: now,
        expiresAt: now + SESSION_TTL_MS,
      };
      await prefsStore().set(JSON.stringify(refreshedPayload));
    }
  } catch {
    /* corrupt — ignore */
  }
}

function persistTokens() {
  if (!currentRefreshToken) {
    return prefsStore().set(null);
  }
  const now = Date.now();
  const payload = {
    accessToken,
    refreshToken: currentRefreshToken,
    savedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  return prefsStore().set(JSON.stringify(payload));
}

export function hasSession() {
  return Boolean(accessToken || currentRefreshToken);
}

export function getAccessToken() {
  return accessToken;
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    if (res.status === 429) {
      const wait = data.retry_after_seconds;
      throw new Error(wait ? `Too many attempts. Please wait ${wait} seconds before trying again.` : (data.message || "Too many attempts. Please wait a moment before trying again."));
    }
    throw new Error(data.message || data.error || "Authentication failed");
  }
  if (data.accessToken) {
    accessToken = data.accessToken;
    currentRefreshToken = data.refreshToken || null;
    await persistTokens();
  }
  return data;
}


export function extractErrorMessage(data, fallback = "An unexpected error occurred") {
  if (!data) return fallback;
  if (data.error === "rate_limited" || data.retry_after_seconds) {
    const s = data.retry_after_seconds;
    return s
      ? `Too many attempts. Please wait ${s} seconds before trying again.`
      : (data.message || "Too many attempts. Please wait a moment before trying again.");
  }
  return data.message || data.error || fallback;
}

const json = (body) => ({ method: "POST", body: JSON.stringify(body) });

/* ---- Auth API ---- */

export async function requestOtp(phone) {
  const res = await callBackend("/api/auth/otp/request", json({ phone }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) {
      const wait = data.retry_after_seconds;
      throw new Error(
        wait
          ? `Too many OTP requests. Please wait ${wait} seconds before requesting a new code.`
          : (data.message || "Too many OTP requests. Please wait a few moments before requesting a new code.")
      );
    }
    throw new Error(data.message || data.error || "Could not send verification code");
  }
  return data;
}

export async function verifyOtp(phone, code) {
  return applyAuthResponse(await callBackend("/api/auth/otp/verify", json({ phone, code })));
}

export async function signup(payload) {
  return applyAuthResponse(await callBackend("/api/auth/signup", json(payload)));
}

export async function login(payload) {
  return applyAuthResponse(await callBackend("/api/auth/login", json(payload)));
}

export async function googleLogin(credential) {
  return applyAuthResponse(await callBackend("/api/auth/google", json({ credential })));
}

export async function lookupStaffCode(code) {
  const res = await callBackend("/api/auth/staff/lookup-code", json({ code }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid Dealer / Business Code");
  return data;
}

export async function staffSignup({ email, password, dealer_code, invite_code, full_name, phone }) {
  const data = await applyAuthResponse(await callBackend("/api/auth/staff/signup", json({
    email, password, dealer_code, invite_code, full_name, phone,
  })));
  broadcastAuthChange("STAFF_SIGNUP");
  return data;
}

export async function requestEmailOtp(email) {
  const res = await callBackend("/api/auth/email/request-otp", json({ email }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not send verification OTP to email");
  return data;
}

export async function verifyEmailOtp(email, code) {
  const res = await callBackend("/api/auth/email/verify-otp", json({ email, code }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not verify email OTP");
  broadcastAuthChange("EMAIL_VERIFIED");
  return data;
}

export async function requestPhoneOtp(phone) {
  const res = await callBackend("/api/auth/phone/request-otp", json({ phone }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not send verification OTP to phone");
  return data;
}

export async function verifyPhoneOtp(phone, code) {
  const res = await callBackend("/api/auth/phone/verify-otp", json({ phone, code }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not verify phone OTP");
  broadcastAuthChange("PHONE_VERIFIED");
  return data;
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

export async function requestDealerRegistrationOtp({ flowId, channel, phone, email }) {
  const targetChannel = channel || (phone ? "phone" : "email");
  const res = await apiFetch(`${AUTH_BASE}/api/dealers/register/${targetChannel}/request-otp`, json({ flowId, phone, email }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Could not send verification code to ${targetChannel}`);
  return data;
}

export async function verifyDealerRegistrationOtp({ flowId, channel, phone, email, code }) {
  const targetChannel = channel || (phone ? "phone" : "email");
  const res = await apiFetch(`${AUTH_BASE}/api/dealers/register/${targetChannel}/verify-otp`, json({ flowId, phone, email, code }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Invalid or expired ${targetChannel} verification code`);
  return data;
}

export async function finalizeDealerRegistration(form) {
  const res = await apiFetch(`${AUTH_BASE}/api/dealers/register/finalize`, json(form));
  const data = await applyAuthResponse(res);
  broadcastAuthChange("DEALER_REGISTERED");
  return data;
}

export async function updateDealerCode(code) {
  const res = await callBackend("/api/dealers/code", json({ code }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update Dealer Code");
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

export async function staffHold(userId) {
  const res = await callBackend(`/api/dealers/staff/${userId}/hold`, json({}));
  if (!res.ok) throw new Error((await res.json()).error || "Hold failed");
}

export async function staffResume(userId) {
  const res = await callBackend(`/api/dealers/staff/${userId}/resume`, json({}));
  if (!res.ok) throw new Error((await res.json()).error || "Resume failed");
}

export async function staffRevoke(userId) {
  const res = await callBackend(`/api/dealers/staff/${userId}/revoke`, json({}));
  if (!res.ok) throw new Error((await res.json()).error || "Revoke failed");
}

export async function staffDeactivate(userId) {
  const res = await callBackend(`/api/dealers/staff/${userId}/deactivate`, json({}));
  if (!res.ok) throw new Error((await res.json()).error || "Deactivate failed");
  broadcastAuthChange("STAFF_UPDATED");
}
export const staffDelete = staffDeactivate;

const AUTH_SYNC_CHANNEL = "shriji_auth_sync_channel";
let authBroadcastChannel = null;

if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    authBroadcastChannel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    if (typeof authBroadcastChannel.unref === "function") {
      authBroadcastChannel.unref();
    }
  } catch {}
}

export function broadcastAuthChange(type = "AUTH_UPDATED") {
  if (authBroadcastChannel) {
    try {
      authBroadcastChannel.postMessage({ type, timestamp: Date.now() });
    } catch {}
  }
}

export function onAuthBroadcast(cb) {
  if (!authBroadcastChannel) return () => {};
  const handler = (e) => cb(e?.data);
  authBroadcastChannel.addEventListener("message", handler);
  return () => authBroadcastChannel.removeEventListener("message", handler);
}

export async function staffTogglePrice(userId, canSeeDealerPrice) {
  const res = await callBackend(`/api/dealers/staff/${userId}/toggle-price`, json({ can_see_dealer_price: canSeeDealerPrice }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Toggle price visibility failed");
  broadcastAuthChange("STAFF_PRICE_TOGGLED");
  return data;
}

export async function staffTogglePriceAll(canSeeDealerPrice) {
  const res = await callBackend("/api/dealers/staff/toggle-price-all", json({ can_see_dealer_price: canSeeDealerPrice }));
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Toggle all staff price visibility failed");
  broadcastAuthChange("STAFF_PRICE_TOGGLED");
  return data;
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
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(SESSION_PROFILE_KEY);
      sessionStorage.removeItem(SESSION_PROFILE_KEY);
    } catch {}
  }
  broadcastAuthChange("AUTH_UPDATED");
}

export async function syncDealerWithCrm() {
  const res = await callBackend("/api/dealers/sync-crm", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Sync failed");
  return data;
}

export function sessionFromAuth(user, dealer) {
  const isDealerSide = user.role === "dealer" || user.role === "dealer_staff" || !!dealer;
  const isStaffInactive = user.role === "dealer_staff" && (user.status === "pending" || user.status === "hold" || user.status === "revoked");
  const dealerStatus = isStaffInactive
    ? user.status
    : dealer?.status || (isDealerSide ? (dealer ? dealer.status : "pending") : "approved");

  const canSeeDealerPrice =
    user.role === "dealer" ||
    (user.role === "dealer_staff" && user.can_see_dealer_price !== false && !dealer?.hide_staff_dealer_price);

  return {
    role: isDealerSide ? "dealer" : "customer",
    status: isDealerSide ? dealerStatus : "approved",
    userStatus: user.status,
    dealerId: dealer?.id || user.dealer_id || null,
    dealer: dealer
      ? {
          id: dealer.id,
          name: dealer.business_name,
          person: null,
          city: null,
          status: dealerStatus,
          dealer_code: dealer.dealer_code,
          price_tier: dealer.price_tier || null,
          pricebookId: dealer.pricebook_id || dealer.pricebookId || dealer.price_tier || null,
          gst_number: dealer.gst_number || null,
          gst_treatment: dealer.gst_treatment || null,
          hide_staff_dealer_price: Boolean(dealer.hide_staff_dealer_price),
        }
      : null,
    email: user.email || null,
    email_verified: Boolean(user.email_verified),
    phone: user.phone || null,
    phone_verified: Boolean(user.phone_verified),
    is_fully_onboarded: Boolean(user.is_fully_onboarded),
    fullName: user.full_name || null,
    userId: user.id,
    authRole: user.role, // customer | dealer | dealer_staff — the backend's real role
    staffPending: user.role === "dealer_staff" && user.status === "pending",
    staffHold: user.role === "dealer_staff" && user.status === "hold",
    canSeeDealerPrice,
  };
}
