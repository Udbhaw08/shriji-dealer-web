import { verifyAccessToken } from "../../backend/src/services/tokens.js";
import { sql } from "../../backend/src/db/pool.js";

const DEFAULT_DEALER_PRICEBOOK_ID = process.env.ZOHO_DEALER_PRICEBOOK_ID || "3334672000000547177";

// In-memory token verification cache: 5s burst cache for instant real-time sync
const tokenCache = new Map();
const CACHE_TTL_MS = 5_000;

/**
 * Validates server-side whether the requesting user is an active, approved dealer
 * or authorized staff member entitled to view wholesale dealer rates.
 * Supports multi-tier verification:
 * 1. Cryptographically verified claims (zero latency)
 * 2. Supabase Postgres check (live status & price tier)
 * 3. Render backend /api/auth/me fallback (resilient across serverless cold starts)
 */
export async function getDealerPricingEligibility(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return { eligible: false, pricebookId: null };
  }

  const forceRefresh = req?.query?.refresh === "true" || req?.query?.refresh === "1";
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (!forceRefresh && cached && now < cached.expiresAt) {
    return { eligible: cached.eligible, pricebookId: cached.pricebookId };
  }

  let result = { eligible: false, pricebookId: null };

  // Tier 1: Local JWT Verification & Live DB Status
  try {
    const claims = verifyAccessToken(token);
    if (claims && claims.sub) {
      if (claims.role === "admin") {
        result = { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
      } else {
        // Query live status and price tier from database
        try {
          const rows = await sql`
            SELECT u.id, u.role, u.status, u.can_see_dealer_price,
                   d.id as dealer_id, d.status as dealer_status, d.price_tier, d.hide_staff_dealer_price
            FROM users u
            LEFT JOIN dealers d ON (d.id = u.dealer_id OR d.owner_user_id = u.id)
            WHERE u.id = ${claims.sub}
            ORDER BY CASE WHEN d.status = 'approved' THEN 1 WHEN d.status = 'pending' THEN 2 ELSE 3 END ASC
            LIMIT 1;
          `;

          if (rows && rows.length > 0) {
            const user = rows[0];
            const effectiveRole = user.role || claims.role;
            const effectiveStatus = user.status || claims.status;
            const dealerStatus = user.dealer_status || (effectiveRole === "dealer" ? effectiveStatus : null);
            const canSeeDealerPrice = user.can_see_dealer_price !== false && claims.can_see_dealer_price !== false;
            const hideStaffPrice = Boolean(user.hide_staff_dealer_price || claims.hide_staff_dealer_price);

            if (effectiveRole === "dealer" && (dealerStatus === "approved" || effectiveStatus === "active")) {
              result = {
                eligible: true,
                pricebookId: user.price_tier || claims.pricebook_id || claims.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
              };
            } else if (
              (effectiveRole === "staff" || effectiveRole === "dealer_staff") &&
              dealerStatus === "approved" &&
              canSeeDealerPrice &&
              !hideStaffPrice
            ) {
              result = {
                eligible: true,
                pricebookId: user.price_tier || claims.pricebook_id || claims.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
              };
            }
          }
        } catch (_dbErr) {
          // If DB query fails, fallback to verified claims
          if (
            (claims.role === "dealer" || claims.role === "staff" || claims.role === "dealer_staff") &&
            (claims.status === "active" || claims.status === "approved") &&
            claims.can_see_dealer_price !== false &&
            !claims.hide_staff_dealer_price
          ) {
            result = {
              eligible: true,
              pricebookId: claims.pricebook_id || claims.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
            };
          }
        }
      }
    }
  } catch (_jwtErr) {
    // Local JWT verification threw (e.g. secret mismatch)
  }

  // Tier 2: Render Backend Fallback (/api/auth/me)
  if (!result.eligible) {
    try {
      const backendUrl =
        process.env.VITE_AUTH_API_URL ||
        process.env.BACKEND_URL ||
        "https://shriji-dealer-web.onrender.com";
      const backendRes = await fetch(`${backendUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3500),
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        const user = data?.user;
        const dealer = data?.dealer;

        if (user && user.status === "active") {
          if (user.role === "admin") {
            result = { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
          } else if (
            (user.role === "dealer" || user.role === "staff" || user.role === "dealer_staff") &&
            dealer?.status === "approved" &&
            user.can_see_dealer_price !== false &&
            !dealer.hide_staff_dealer_price
          ) {
            result = {
              eligible: true,
              pricebookId: dealer.pricebook_id || dealer.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
            };
          }
        }
      }
    } catch (_backendErr) {
      // Backend check unreachable
    }
  }

  // Cache verification result
  tokenCache.set(token, {
    eligible: result.eligible,
    pricebookId: result.pricebookId,
    expiresAt: now + CACHE_TTL_MS,
  });

  return result;
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
