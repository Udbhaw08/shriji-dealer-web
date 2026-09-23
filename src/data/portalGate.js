import { isDealer } from "./dealer";

/**
 * PORTAL ACCESS GATE
 * When enabled, the portal is restricted to logged-in and verified dealers only.
 * Guests / customers can only see:
 * 1. The common home page (with a prominent "Verified Dealer Login" button).
 * 2. Directly shared product links (/products/:id or ?from=...).
 *
 * All catalog browsing (/products), schemes (/schemes), support (/support),
 * and mobile bottom navigation are locked for non-dealers.
 *
 * To disable this gate and restore open browsing, set PORTAL_GATE_ENABLED = false.
 */
export const PORTAL_GATE_ENABLED = true;

/**
 * Returns true if the user session is gated from accessing full portal features.
 */
export function isPortalGated(session) {
  if (!PORTAL_GATE_ENABLED) return false;
  return !isDealer(session);
}
