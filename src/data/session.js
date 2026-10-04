import { useSyncExternalStore } from "react";
import { isDealer, tierOf, registerDealer } from "./dealer";
import {
  initTokens, hasSession, fetchMe, logout as authLogout, sessionFromAuth,
} from "./auth";

export { isDealer, tierOf };

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

export function setSession(next) {
  if (next.dealer) registerDealer(next.dealer);
  state = next;
  emit();
}

export async function signOut() {
  await authLogout().catch(() => {});
  setSession(GUEST);
}

/**
 * Re-validate against the backend: who am I, and is my dealer approved yet?
 * This is also the pending-approval poll — call it on a timer from the UI.
 */
export async function revalidateSession() {
  if (!hasSession()) {
    if (state !== GUEST) setSession(GUEST);
    return null;
  }
  try {
    const data = await fetchMe();
    if (!data || !data.user) {
      // token dead and refresh failed — back to guest
      await authLogout().catch(() => {});
      setSession(GUEST);
      return null;
    }
    const next = sessionFromAuth(data.user, data.dealer);
    setSession(next);
    return next;
  } catch {
    return state; // offline — keep showing what we have
  }
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

// Restore tokens from secure storage and hydrate the session on startup
if (typeof window !== "undefined") {
  initTokens().then(revalidateSession);
}
