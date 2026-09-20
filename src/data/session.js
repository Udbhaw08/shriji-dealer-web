import { useSyncExternalStore } from "react";
import { isDealer, tierOf } from "./dealer";

export { isDealer, tierOf };

/* Who is looking at the screen.
 *
 * ponytail: a tiny external store instead of a context provider — no wrapper in
 * main.jsx, and `useSession()` works from any component. localStorage keeps the
 * demo alive across reloads.
 *
 * THIS IS DEMO AUTHENTICATION. It proves the flow, not the security. The real
 * rule is server-side and non-negotiable: dealer pricing is returned only to a
 * request carrying an approved dealer's session. A client-side role check is a
 * UI convenience, never the thing that protects a price. See docs/ROLES-AND-SHARING.md.
 */

const KEY = "shriji.session";

export const GUEST = { role: "guest" };

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || GUEST;
  } catch {
    return GUEST;
  }
}

let state = load();
const subs = new Set();

function emit() {
  try {
    if (state.role === "guest") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode — the session just does not survive a reload */
  }
  for (const fn of subs) fn();
}

export function setSession(next) {
  state = next;
  emit();
}

export function signOut() {
  setSession(GUEST);
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

