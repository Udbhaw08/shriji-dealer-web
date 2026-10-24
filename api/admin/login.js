import crypto from "node:crypto";
import { signAdminToken } from "../../backend/src/services/tokens.js";
import { verifyAdminAuth } from "../_lib/adminAuth.js";

/**
 * Serverless handler for Admin Authentication
 * POST /api/admin/login:
 *   Validates adminKey against process.env.ADMIN_API_KEY.
 *   Returns short-lived signed JWT session token (1 hour).
 * GET /api/admin/login or GET /api/admin/session:
 *   Verifies whether current Bearer token or X-Admin-Key is valid.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET: verify current admin session
  if (req.method === "GET") {
    const auth = await verifyAdminAuth(req);
    if (!auth || !auth.ok) {
      return res.status(401).json({ ok: false, error: "admin_auth_required" });
    }
    return res.status(200).json({ ok: true, admin: true, authenticated: true });
  }

  // POST: authenticate with admin secret key
  if (req.method === "POST") {
    const configuredAdminKey = process.env.ADMIN_API_KEY || "";

    if (!configuredAdminKey || configuredAdminKey.length < 16) {
      return res.status(503).json({
        ok: false,
        error: "admin_auth_not_configured",
        message: "Administrative authentication is not configured on this server.",
      });
    }

    const candidateKey = String(req.body?.adminKey || "");

    let isMatch = false;
    if (candidateKey.length === configuredAdminKey.length) {
      try {
        isMatch = crypto.timingSafeEqual(
          Buffer.from(candidateKey, "utf8"),
          Buffer.from(configuredAdminKey, "utf8")
        );
      } catch {
        isMatch = false;
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        ok: false,
        error: "invalid_admin_credentials",
        message: "Invalid administrative credentials.",
      });
    }

    const token = signAdminToken({ expiresIn: 3600 });
    return res.status(200).json({
      ok: true,
      token,
      expiresIn: 3600,
      message: "Admin session authenticated successfully.",
    });
  }

  res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
