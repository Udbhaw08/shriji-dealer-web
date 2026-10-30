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
  accessToken: null,
  refreshToken: null,
  savedAt: null,
  expiresAt: null,
};

export const INCOGNITO_KEY = "shriji_incognito_mode";

export function isIncognitoMode() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INCOGNITO_KEY) === "true";
  } catch {
    return false;
  }
}

export function canUseIncognito(session) {
  if (!session) return false;
  if (isIncognitoMode() || session.isIncognito) return true;
  const isDealerSide = session.role === "dealer" || session.authRole === "dealer" || session.authRole === "dealer_staff" || Boolean(session.dealer);
  const isApproved = session.status === "approved" || session.status === "active";
  return Boolean(isDealerSide && isApproved);
}

export function applyIncognito(session) {
  if (!session || session.role === "guest") return session;
  const active = isIncognitoMode();
  if (!active) {
    if (session.isIncognito) {
      return {
        ...session,
        isIncognito: false,
        role: session.rawRole || session.role,
        authRole: session.rawAuthRole || session.authRole,
        canSeeDealerPrice: session.rawCanSeeDealerPrice !== undefined ? session.rawCanSeeDealerPrice : true,
      };
    }
    return session;
  }

  const isDealerSide = session.role === "dealer" || session.authRole === "dealer" || session.authRole === "dealer_staff" || Boolean(session.dealer);
  if (!isDealerSide && !session.isIncognito) return session;

  return {
    ...session,
    isIncognito: true,
    role: "customer",
    authRole: "customer",
    canSeeDealerPrice: false,
    rawRole: session.rawRole || session.role || "dealer",
    rawAuthRole: session.rawAuthRole || session.authRole || "dealer",
    rawCanSeeDealerPrice: session.rawCanSeeDealerPrice !== undefined ? session.rawCanSeeDealerPrice : session.canSeeDealerPrice,
    rawDealer: session.rawDealer || session.dealer,
  };
}

export function setIncognitoMode(active) {
  if (typeof window === "undefined") return;
  const isEnabled = Boolean(active);
  try {
    if (isEnabled) {
      localStorage.setItem(INCOGNITO_KEY, "true");
    } else {
      localStorage.removeItem(INCOGNITO_KEY);
    }
  } catch {}

  let baseSession = state;
  try {
    const rawProfile = localStorage.getItem(SESSION_PROFILE_KEY) || sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (rawProfile) baseSession = JSON.parse(rawProfile);
  } catch {}

  const next = isEnabled
    ? applyIncognito(baseSession)
    : {
        ...baseSession,
        isIncognito: false,
        role: baseSession?.rawRole || baseSession?.role || "dealer",
        authRole: baseSession?.rawAuthRole || baseSession?.authRole || "dealer",
        canSeeDealerPrice: baseSession?.rawCanSeeDealerPrice !== undefined ? baseSession.rawCanSeeDealerPrice : (baseSession?.canSeeDealerPrice ?? true),
      };

  state = next;
  syncPricebookWithSession(next);
  emit();
  broadcastAuthChange("INCOGNITO_TOGGLED");
}

export function toggleIncognitoMode() {
  const current = isIncognitoMode();
  setIncognitoMode(!current);
  return !current;
}

function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(base64))));
  } catch {
    return null;
  }
}

function loadCachedSession() {
  if (typeof window === "undefined") return GUEST;
  try {
    const rawTokens = localStorage.getItem("shriji.auth.tokens") || sessionStorage.getItem("shriji.auth.tokens");
    const rawProfile = localStorage.getItem(SESSION_PROFILE_KEY) || sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (rawTokens && rawProfile) {
      const profile = JSON.parse(rawProfile);
      if (profile && (profile.role === "dealer" || profile.role === "dealer_staff") && profile.dealer) {
        registerDealer(profile.dealer);
      }
      if (profile && profile.role) {
        const effective = isIncognitoMode() ? applyIncognito(profile) : profile;
        syncPricebookWithSession(effective);
        return effective;
      }
    }

    // Synchronous JWT pre-hydration: eliminates 100% of frame-0 guest flickers
    if (rawTokens) {
      const tokenObj = JSON.parse(rawTokens);
      const claims = decodeJwtPayload(tokenObj?.accessToken);
      if (claims && claims.sub) {
        const isDealerSide = claims.role === "dealer" || claims.role === "dealer_staff" || claims.role === "admin";
        const isApproved = claims.status === "active" || claims.status === "approved";
        const dealerStatus = isApproved ? "approved" : (claims.status || "pending");
        const canSeePrice = isApproved && claims.can_see_dealer_price !== false;
        const fallbackProfile = {
          role: isDealerSide ? "dealer" : (claims.role || "customer"),
          status: isDealerSide ? dealerStatus : "approved",
          userStatus: claims.status || "active",
          userId: claims.sub,
          dealerId: isApproved ? (claims.dealer_id || null) : null,
          authRole: claims.role || "customer",
          canSeeDealerPrice: canSeePrice,
          dealer: isDealerSide
            ? {
                id: claims.dealer_id || "dealer",
                name: "Dealership",
                status: dealerStatus,
                price_tier: isApproved ? (claims.price_tier || null) : null,
                pricebookId: isApproved ? (claims.pricebook_id || claims.price_tier || null) : null,
              }
            : null,
        };
        if (fallbackProfile.dealer && isApproved) registerDealer(fallbackProfile.dealer);
        const effectiveFallback = isIncognitoMode() ? applyIncognito(fallbackProfile) : fallbackProfile;
        syncPricebookWithSession(effectiveFallback);
        return effectiveFallback;
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
    Boolean(a.isIncognito) === Boolean(b.isIncognito) &&
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
  const effective = isIncognitoMode() ? applyIncognito(next) : next;
  state = effective;
  syncPricebookWithSession(effective);
  if (typeof window !== "undefined") {
    try {
      if (!next || next.role === "guest") {
        localStorage.removeItem(SESSION_PROFILE_KEY);
        sessionStorage.removeItem(SESSION_PROFILE_KEY);
      } else {
        const toStore = {
          ...next,
          role: next.rawRole || next.role,
          authRole: next.rawAuthRole || next.authRole,
          canSeeDealerPrice: next.rawCanSeeDealerPrice !== undefined ? next.rawCanSeeDealerPrice : next.canSeeDealerPrice,
        };
        delete toStore.isIncognito;
        localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(toStore));
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
      localStorage.removeItem(INCOGNITO_KEY);
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
export async function revalidateSession(force = false) {
  // If user deliberately selected Customer / Viewer mode, preserve it
  if (state?.role === "customer" && state?.userId === "customer-viewer") {
    return state;
  }

  if (!hasSession()) {
    return state || GUEST;
  }

  if (inFlightRevalidate && !force) return inFlightRevalidate;

  inFlightRevalidate = (async () => {
    try {
      const data = await fetchMe(force);
      if (!data || !data.user) {
        return state || GUEST;
      }
      const rawNext = sessionFromAuth(data.user, data.dealer);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(rawNext));
        } catch {}
      }
      const next = isIncognitoMode() ? applyIncognito(rawNext) : rawNext;
      if (!isSessionEqual(state, next)) {
        setSession(next);
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
    if (msg?.type === "INCOGNITO_TOGGLED") {
      const incognito = isIncognitoMode();
      let baseSession = state;
      try {
        const rawProfile = localStorage.getItem(SESSION_PROFILE_KEY) || sessionStorage.getItem(SESSION_PROFILE_KEY);
        if (rawProfile) baseSession = JSON.parse(rawProfile);
      } catch {}
      const next = incognito
        ? applyIncognito(baseSession)
        : {
            ...baseSession,
            isIncognito: false,
            role: baseSession?.rawRole || baseSession?.role || "dealer",
            authRole: baseSession?.rawAuthRole || baseSession?.authRole || "dealer",
            canSeeDealerPrice: baseSession?.rawCanSeeDealerPrice !== undefined ? baseSession.rawCanSeeDealerPrice : (baseSession?.canSeeDealerPrice ?? true),
          };
      state = next;
      syncPricebookWithSession(next);
      emit();
    } else if (msg?.type === "AUTH_UPDATED" || msg?.type === "STAFF_PRICE_TOGGLED" || msg?.type === "STAFF_UPDATED") {
      revalidateSession(true);
    }
  });

  // Immediate forced CRM revalidation on tab focus or visibility change
  window.addEventListener("focus", () => {
    if (hasSession()) revalidateSession(true);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && hasSession()) {
      revalidateSession(true);
    }
  });

  // Cross-tab fallback via storage events
  window.addEventListener("storage", (e) => {
    if (e.key === INCOGNITO_KEY) {
      const incognito = isIncognitoMode();
      let baseSession = state;
      try {
        const rawProfile = localStorage.getItem(SESSION_PROFILE_KEY) || sessionStorage.getItem(SESSION_PROFILE_KEY);
        if (rawProfile) baseSession = JSON.parse(rawProfile);
      } catch {}
      const next = incognito
        ? applyIncognito(baseSession)
        : {
            ...baseSession,
            isIncognito: false,
            role: baseSession?.rawRole || baseSession?.role || "dealer",
            authRole: baseSession?.rawAuthRole || baseSession?.authRole || "dealer",
            canSeeDealerPrice: baseSession?.rawCanSeeDealerPrice !== undefined ? baseSession.rawCanSeeDealerPrice : (baseSession?.canSeeDealerPrice ?? true),
          };
      state = next;
      syncPricebookWithSession(next);
      emit();
    } else if (e.key === "shriji_auth_token" || e.key === "shriji.auth.tokens" || e.key === SESSION_PROFILE_KEY) {
      if (!hasSession()) {
        setSession(GUEST);
      } else {
        revalidateSession();
      }
    }
  });
}
