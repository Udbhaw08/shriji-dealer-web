import { verifyAccessToken } from "../../backend/src/services/tokens.js";
import { sql } from "../../backend/src/db/pool.js";

const DEFAULT_DEALER_PRICEBOOK_ID = process.env.ZOHO_DEALER_PRICEBOOK_ID || "3334672000000547177";

// In-memory token verification cache to minimize DB queries and network overhead
const tokenCache = new Map();
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Validates server-side whether the requesting user is an active, approved dealer
 * or authorized staff member entitled to view wholesale dealer rates.
 * Supports multi-tier verification:
 * 1. Cryptographically verified claims (zero latency)
 * 2. Supabase Postgres check (when reachable)
 * 3. Render backend /api/auth/me fallback (resilient across serverless cold starts)
 */
export async function getDealerPricingEligibility(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return { eligible: false, pricebookId: null };
  }

  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && now < cached.expiresAt) {
    return { eligible: cached.eligible, pricebookId: cached.pricebookId };
  }

  let result = { eligible: false, pricebookId: null };

  // Tier 1: Local JWT Verification & Verified Claims
  try {
    const claims = verifyAccessToken(token);
    if (claims && claims.sub) {
      if (claims.role === "admin") {
        result = { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
      } else if (
        (claims.role === "dealer" || claims.role === "staff" || claims.role === "dealer_staff") &&
        (claims.status === "active" || claims.status === "approved") &&
        claims.can_see_dealer_price !== false &&
        !claims.hide_staff_dealer_price
      ) {
        // If claims carry explicit pricebook_id or price_tier, trust verified token
        if (claims.pricebook_id || claims.price_tier) {
          result = {
            eligible: true,
            pricebookId: claims.pricebook_id || claims.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
          };
        }
      }

      // If DB is available, verify live status against database
      if (!result.eligible || !result.pricebookId) {
        try {
          const rows = await sql`
            SELECT u.id, u.role, u.status, u.can_see_dealer_price,
                   d.id as dealer_id, d.status as dealer_status, d.price_tier, d.hide_staff_dealer_price
            FROM users u
            LEFT JOIN dealers d ON d.id = u.dealer_id
            WHERE u.id = ${claims.sub}
            LIMIT 1;
          `;

          if (rows && rows.length > 0) {
            const user = rows[0];
            if (user.status === "active") {
              if (user.role === "admin") {
                result = { eligible: true, pricebookId: DEFAULT_DEALER_PRICEBOOK_ID };
              } else if (user.role === "dealer" && user.dealer_status === "approved") {
                result = {
                  eligible: true,
                  pricebookId: user.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
                };
              } else if (
                (user.role === "staff" || user.role === "dealer_staff") &&
                user.dealer_status === "approved" &&
                user.can_see_dealer_price !== false &&
                !user.hide_staff_dealer_price
              ) {
                result = {
                  eligible: true,
                  pricebookId: user.price_tier || DEFAULT_DEALER_PRICEBOOK_ID,
                };
              }
            }
          }
        } catch (_dbErr) {
          // If DB query fails, fallback to claims if dealer status is active
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
