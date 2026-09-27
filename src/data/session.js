import { useSyncExternalStore } from "react";
import { isDealer, tierOf, registerDealer } from "./dealer";
import { apiFetch, apiUrl } from "./api";

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
    const s = JSON.parse(localStorage.getItem(KEY)) || GUEST;
    if (s.dealer) registerDealer(s.dealer);
    return s;
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
  if (next.dealer) registerDealer(next.dealer);
  state = next;
  emit();
}

export function signOut() {
  setSession(GUEST);
}

export function revalidateSession() {
  const current = state;
  const id = current?.dealerId || current?.dealer?.id;
  if (!id) return;

  apiFetch(`/api/dealer/info?id=${encodeURIComponent(id)}`)
    .then((r) => r.json())
    .then((data) => {
      if (data.ok && data.dealer) {
        setSession({
          role: "dealer",
          status: data.dealer.status, // "approved" or "pending"
          dealerId: data.dealer.id,
          dealer: data.dealer,
          shop: data.dealer.name,
          person: data.dealer.person,
          phone: data.dealer.phone,
          city: data.dealer.city,
        });
      }
    })
    .catch(() => {});
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

// Automatically sync latest status & pricebook from Zoho on startup
if (typeof window !== "undefined") {
  revalidateSession();
}

