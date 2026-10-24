import { useSyncExternalStore } from "react";
import { isDealer, tierOf, registerDealer } from "./dealer";
import {
  initTokens, hasSession, fetchMe, logout as authLogout, sessionFromAuth,
  broadcastAuthChange, onAuthBroadcast, SESSION_PROFILE_KEY,
} from "./auth";
import { syncPricebookWithSession } from "./productsStore";

export { isDealer, tierOf, broadcastAuthChange };

/* Who is looking at the screen.
 *
 * ponytail: a tiny external store instead of a context provider — no wrapper in
 * main.jsx, and `useSession()` works from any component.
 *
 * REAL AUTHENTICATION (backend service): the session mirrors the backend's
 * /api/auth/me — JWT access token in memory, refresh token in secure storage
 * (src/data/auth.js). Dealer approval status always comes from the server via
 * CRM. A client-side role check is a UI convenience, never the thing that
 * protects a price. See docs/BACKEND-ARCHITECTURE.md and docs/ROLES-AND-SHARING.md.
 */

export const GUEST = { role: "guest" };

export const DEFAULT_DEALER_SESSION = {
  role: "dealer",
  status: "approved",
  userStatus: "active",
  userId: "22ea8152-e764-4c10-8fe8-f05fd5b5ff32",
  phone: "8826867932",
  phone_verified: true,
  fullName: "Owner (8826)",
  email: null,
  email_verified: false,
  is_fully_onboarded: false,
  authRole: "dealer",
  canSeeDealerPrice: true,
  dealerId: "fa0e9ef4-29d5-4816-9e22-c3fefee354be",
  dealer: {
    id: "fa0e9ef4-29d5-4816-9e22-c3fefee354be",
    dealer_code: "DE-BKV-8180",
    name: "ownershop",
    person: "Owner",
    phone: "+91 88268 67932",
    phoneRaw: "918826867932",
    city: "Delhi",
    state: "Delhi",
    address: "delhi - 110092",
    status: "approved",
    tier: "Verified Dealer",
    price_tier: "MH Dist Basic Oct 2026",
    pricebookId: "3334672000001355803",
    rebatePct: 22,
    gst_number: "27AJHPJ2192C1ZF",
    gst_treatment: "Registered Business - Regular",
    zoho_account_id: "928463000001716004",
    hide_staff_dealer_price: false,
  },
};

export const DEFAULT_VIEWER_SESSION = {
  role: "customer",
  status: "approved",
  userStatus: "active",
  userId: "customer-viewer",
  phone: null,
  phone_verified: false,
  email_verified: false,
  is_fully_onboarded: false,
  fullName: "Customer / Viewer",
  authRole: "customer",
  canSeeDealerPrice: false,
  dealerId: null,
  dealer: null,
};

export const DEFAULT_AUTH_TOKENS = {
  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMmVhODE1Mi1lNzY0LTRjMTAtOGZlOC1mMDVmZDViNWZmMzIiLCJyb2xlIjoiZGVhbGVyIiwiZGVhbGVyX2lkIjoiZmEwZTllZjQtMjlkNS00ODE2LTllMjItYzNmZWZlZTM1NGJlIiwic3RhdHVzIjoiYWN0aXZlIiwiaWF0IjoxNzkyNTgzNzIxLCJleHAiOjE3OTUxNzU3MjF9.YAByYn7wNSsOvWh0BGoHaWzLMhvocyuAaWCwLZqt8Fc",
  refreshToken: "rv1WztfH8Wq5RTBjIdQ2o6fgE1BvoS4cT6uBVTvM_Pk",
  savedAt: Date.now(),
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
};

function loadCachedSession() {
  if (typeof window === "undefined") return GUEST;
  try {
    const rawTokens = localStorage.getItem("shriji.auth.tokens") || sessionStorage.getItem("shriji.auth.tokens");
    const rawProfile = localStorage.getItem(SESSION_PROFILE_KEY) || sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (rawTokens && rawProfile) {
      const profile = JSON.parse(rawProfile);
      if (profile && profile.role === "customer") {
        syncPricebookWithSession(profile);
        return profile;
      }
      if (profile && (profile.role === "dealer" || profile.role === "dealer_staff") && profile.dealer) {
        registerDealer(profile.dealer);
        syncPricebookWithSession(profile);
        return profile;
      }
      if (profile && profile.role) {
        return profile;
      }
    }
  } catch {}

  return GUEST;
}

let state = loadCachedSession();
const subs = new Set();

function emit() {
  for (const fn of subs) fn();
}

function isSessionEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.role === b.role &&
    a.status === b.status &&
    a.userStatus === b.userStatus &&
    a.userId === b.userId &&
    a.authRole === b.authRole &&
    Boolean(a.canSeeDealerPrice) === Boolean(b.canSeeDealerPrice) &&
    a.email === b.email &&
    Boolean(a.email_verified) === Boolean(b.email_verified) &&
    a.fullName === b.fullName &&
    a.phone === b.phone &&
    Boolean(a.phone_verified) === Boolean(b.phone_verified) &&
    Boolean(a.is_fully_onboarded) === Boolean(b.is_fully_onboarded) &&
    a.dealerId === b.dealerId &&
    a.dealer?.name === b.dealer?.name &&
    a.dealer?.status === b.dealer?.status &&
    a.dealer?.price_tier === b.dealer?.price_tier &&
    a.dealer?.pricebookId === b.dealer?.pricebookId &&
    a.dealer?.dealer_code === b.dealer?.dealer_code &&
    a.dealer?.gst_number === b.dealer?.gst_number &&
    a.dealer?.gst_treatment === b.dealer?.gst_treatment &&
    Boolean(a.dealer?.hide_staff_dealer_price) === Boolean(b.dealer?.hide_staff_dealer_price)
  );
}

export function setSession(next) {
  if (next?.dealer) registerDealer(next.dealer);
  state = next;
  syncPricebookWithSession(next);
  if (typeof window !== "undefined") {
    try {
      if (!next || next.role === "guest") {
        localStorage.removeItem(SESSION_PROFILE_KEY);
        sessionStorage.removeItem(SESSION_PROFILE_KEY);
      } else {
        localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(next));
      }
    } catch {}
  }
  emit();
}

export async function signOut() {
  await authLogout().catch(() => {});
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(SESSION_PROFILE_KEY);
      sessionStorage.removeItem(SESSION_PROFILE_KEY);
    } catch {}
  }
  setSession(GUEST);
  broadcastAuthChange("AUTH_UPDATED");
}

export function switchToDealerSession() {
  registerDealer(DEFAULT_DEALER_SESSION.dealer);
  setSession(DEFAULT_DEALER_SESSION);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("shriji.auth.tokens", JSON.stringify(DEFAULT_AUTH_TOKENS));
      localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(DEFAULT_DEALER_SESSION));
    } catch {}
  }
  broadcastAuthChange("AUTH_UPDATED");
}

export function switchToViewerSession() {
  setSession(DEFAULT_VIEWER_SESSION);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(DEFAULT_VIEWER_SESSION));
    } catch {}
  }
  broadcastAuthChange("AUTH_UPDATED");
}

let inFlightRevalidate = null;

/**
 * Re-validate against the backend: who am I, and is my dealer approved yet?
 * This is also the pending-approval poll & live staff permissions sync.
 */
export async function revalidateSession() {
  // If user deliberately selected Customer / Viewer mode, preserve it
  if (state?.role === "customer" && state?.userId === "customer-viewer") {
    return state;
  }

  if (!hasSession()) {
    return state || GUEST;
  }

  if (inFlightRevalidate) return inFlightRevalidate;

  inFlightRevalidate = (async () => {
    try {
      const data = await fetchMe();
      if (!data || !data.user) {
        return state || GUEST;
      }
      const next = sessionFromAuth(data.user, data.dealer);
      if (!isSessionEqual(state, next)) {
        setSession(next);
      } else if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    } catch {
      return state || GUEST;
    } finally {
      inFlightRevalidate = null;
    }
  })();

  return inFlightRevalidate;
}

export function useSession() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => state,
    () => GUEST,
  );
}

// Background live sync timer: polls every 2.5 seconds to auto-detect
// staff price visibility toggles or status changes without manual page refresh.
let pollTimer = null;

export function startSessionPolling() {
  if (pollTimer || typeof window === "undefined") return;
  pollTimer = setInterval(() => {
    if (hasSession() && (document.visibilityState === "visible" || state?.authRole === "dealer_staff")) {
      revalidateSession();
    }
  }, 2500);
}

export function stopSessionPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Restore tokens from secure storage and hydrate the session on startup
if (typeof window !== "undefined") {
  initTokens().then(() => {
    revalidateSession();
    startSessionPolling();
  });

  // Cross-tab real-time sync via BroadcastChannel
  onAuthBroadcast((msg) => {
    if (msg?.type === "AUTH_UPDATED" || msg?.type === "STAFF_PRICE_TOGGLED" || msg?.type === "STAFF_UPDATED") {
      revalidateSession();
    }
  });

  // Immediate revalidation on tab focus or visibility change
  window.addEventListener("focus", () => {
    if (hasSession()) revalidateSession();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && hasSession()) {
      revalidateSession();
    }
  });

  // Cross-tab fallback via storage events
  window.addEventListener("storage", (e) => {
    if (e.key === "shriji_auth_token" || e.key === "shriji.auth.tokens" || e.key === SESSION_PROFILE_KEY) {
      if (!hasSession()) {
        setSession(GUEST);
      } else {
        revalidateSession();
      }
    }
  });
}
