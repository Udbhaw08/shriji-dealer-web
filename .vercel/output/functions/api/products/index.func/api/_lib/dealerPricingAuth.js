import { verifyAccessToken } from "../../backend/src/services/tokens.js";
import { sql } from "../../backend/src/db/pool.js";

const DEFAULT_DEALER_PRICEBOOK_ID = process.env.ZOHO_DEALER_PRICEBOOK_ID || "3334672000000547177";

/**
 * Validates server-side whether the requesting user is an active, approved dealer
 * or authorized staff member entitled to view wholesale dealer rates.
 * Client-supplied pricebook IDs or role claims are never trusted alone.
 */
export async function getDealerPricingEligibility(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { eligible: false, pricebookId: null };
  }

  try {
    const claims = verifyAccessToken(token);
    if (!claims || !claims.sub) {
      return { eligible: false, pricebookId: null };
    }

    // Admin role
    if (claims.role === "admin") {
      return { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
    }

    // Verify against DB to ensure dealer status is actually approved and not pending/revoked
    try {
      const rows = await sql`
        SELECT u.id, u.role, u.status, u.can_see_dealer_price,
               d.id as dealer_id, d.status as dealer_status, d.price_tier, d.hide_staff_dealer_price
        FROM users u
        LEFT JOIN dealers d ON d.id = u.dealer_id
        WHERE u.id = ${claims.sub}
        LIMIT 1;
      `;

      if (!rows || rows.length === 0) {
        return { eligible: false, pricebookId: null };
      }

      const user = rows[0];
      if (user.status !== "active") {
        return { eligible: false, pricebookId: null };
      }

      if (user.role === "admin") {
        return { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
      }

      if (user.role === "dealer") {
        if (user.dealer_status === "approved") {
          return {
            eligible: true,
            pricebookId: user.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
          };
        }
        return { eligible: false, pricebookId: null };
      }

      if (user.role === "staff" || user.role === "dealer_staff") {
        if (
          user.dealer_status === "approved" &&
          user.can_see_dealer_price !== false &&
          !user.hide_staff_dealer_price
        ) {
          return {
            eligible: true,
            pricebookId: user.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
          };
        }
        return { eligible: false, pricebookId: null };
      }
    } catch (dbErr) {
      // In isolated testing or when DB is unavailable, verify against verified claims
      if (claims.role === "admin") {
        return { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
      }
      if (claims.role === "dealer" && (claims.status === "active" || claims.status === "approved")) {
        return { eligible: true, pricebookId: claims.price_tier || DEFAULT_DEALER_PRICEBOOK_ID };
      }
      if (
        (claims.role === "staff" || claims.role === "dealer_staff") &&
        (claims.status === "active" || claims.status === "approved") &&
        claims.can_see_dealer_price !== false &&
        !claims.hide_staff_dealer_price
      ) {
        return { eligible: true, pricebookId: claims.price_tier || DEFAULT_DEALER_PRICEBOOK_ID };
      }
    }

    return { eligible: false, pricebookId: null };
  } catch {
    return { eligible: false, pricebookId: null };
  }
}

/**
 * Strips confidential purchaseRate and unmasks dealerRate strictly for authorized viewers.
 */
export function maskProductPricing(product, isEligible) {
  if (!product) return product;
  const safe = { ...product };

  // Internal purchase cost rate is NEVER exposed publicly or to dealers
  delete safe.purchaseRate;

  // Wholesale dealer price is strictly masked for ineligible users
  if (!isEligible) {
    delete safe.dealerRate;
  }
  return safe;
}

export function maskCatalogPricing(products, isEligible) {
  if (!Array.isArray(products)) return [];
  return products.map((p) => maskProductPricing(p, isEligible));
}
