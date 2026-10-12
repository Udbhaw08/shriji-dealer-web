import { useSyncExternalStore } from "react";
import { isDealer, tierOf, registerDealer } from "./dealer";
import {
  initTokens, hasSession, fetchMe, logout as authLogout, sessionFromAuth,
  broadcastAuthChange, onAuthBroadcast,
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

let state = GUEST;
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
    a.dealerId === b.dealerId &&
    a.dealer?.status === b.dealer?.status &&
    a.dealer?.price_tier === b.dealer?.price_tier &&
    a.dealer?.pricebookId === b.dealer?.pricebookId &&
    a.dealer?.dealer_code === b.dealer?.dealer_code &&
    Boolean(a.dealer?.hide_staff_dealer_price) === Boolean(b.dealer?.hide_staff_dealer_price)
  );
}

export function setSession(next) {
  if (next?.dealer) registerDealer(next.dealer);
  state = next;
  syncPricebookWithSession(next);
  emit();
}

export async function signOut() {
  await authLogout().catch(() => {});
  setSession(GUEST);
  broadcastAuthChange("AUTH_UPDATED");
}

let inFlightRevalidate = null;

/**
 * Re-validate against the backend: who am I, and is my dealer approved yet?
 * This is also the pending-approval poll & live staff permissions sync.
 */
export async function revalidateSession() {
  if (!hasSession()) {
    if (state !== GUEST) setSession(GUEST);
    return null;
  }
  if (inFlightRevalidate) return inFlightRevalidate;

  inFlightRevalidate = (async () => {
    try {
      const data = await fetchMe();
      if (!data || !data.user) {
        // token dead and refresh failed — back to guest
        await authLogout().catch(() => {});
        setSession(GUEST);
        return null;
      }
      const next = sessionFromAuth(data.user, data.dealer);
      if (!isSessionEqual(state, next)) {
        setSession(next);
      }
      return next;
    } catch {
      return state; // offline — keep showing what we have
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
    if (e.key === "shriji_auth_token" || e.key === "shriji.auth.tokens") {
      revalidateSession();
    }
  });
}
