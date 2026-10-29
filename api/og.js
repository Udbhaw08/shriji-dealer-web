import fs from "node:fs";
import path from "node:path";
import { fetchZohoProductById } from "./_lib/zoho.js";
import { escapeHtml, sanitizeUrl, sanitizeHost } from "./_lib/htmlEscape.js";

/**
 * Serverless handler for product pages on Vercel.
 * Dynamically injects Open Graph meta tags (og:title, og:image, og:description)
 * so that WhatsApp, Telegram, Facebook, and Twitter crawlers render rich previews
 * with the product image and dealer details.
 *
 * Fully protected against Reflected XSS and Attribute Injection.
 */
export default async function handler(req, res) {
  try {
    const { slug, pid, name, city, state, phone } = req.query || {};
    const lookupKey = pid || slug;

    // Load static HTML template
    let html = "";
    const possiblePaths = [
      path.join(process.cwd(), "dist", "index.html"),
      path.join(process.cwd(), "index.html"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        html = fs.readFileSync(p, "utf-8");
        break;
      }
    }

    if (!html) {
      return res.status(500).send("Index template not found");
    }

    if (!lookupKey) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    const product = await fetchZohoProductById(lookupKey);
    if (!product) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    }

    const dealerName = typeof name === "string" ? name.trim() : "";
    const dealerCity = typeof city === "string" ? city.trim() : "";
    const dealerState = typeof state === "string" ? state.trim() : "";
    const dealerPhone = typeof phone === "string" ? phone.trim() : "";
    const dealerLoc = [dealerCity, dealerState].filter(Boolean).join(", ");
    const priceStr = product.mrp > 0 ? `₹${Number(product.mrp).toLocaleString("en-IN")}` : "Price on Request";

    const rawTitle = `${product.name || "Sunshine Appliance"} · Sunshine Appliances`;
    const rawDesc = dealerName
      ? `Retail MRP: ${priceStr} (Incl. of all taxes) · Available with Sunshine Partner (${dealerName})${dealerLoc ? ` (${dealerLoc})` : ""}${dealerPhone ? ` • Contact: ${dealerPhone}` : ""}`
      : `Retail MRP: ${priceStr} (Incl. of all taxes) · Sunshine ReSTOR`;

    // Strictly sanitize scheme, host and path
    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = forwardedProto === "http" ? "http" : "https";
    const rawHost = req.headers["x-forwarded-host"] || req.headers.host || "restor.in";
    const host = sanitizeHost(rawHost);

    const rawImg = product.img || `${proto}://${host}/img/hero-stove.webp`;
    const safeImgUrl = sanitizeUrl(rawImg) || `https://${host}/img/hero-stove.webp`;

    // Parse and reconstruct canonical request URL safely
    let currentUrl = `https://${host}/`;
    try {
      const parsedReqUrl = new URL(req.url || "/", `${proto}://${host}`);
      currentUrl = parsedReqUrl.href;
    } catch {
      currentUrl = `https://${host}/`;
    }

    // HTML entity escaping for attributes & title
    const escapedTitle = escapeHtml(rawTitle);
    const escapedDesc = escapeHtml(rawDesc);
    const escapedImg = escapeHtml(safeImgUrl);
    const escapedUrl = escapeHtml(currentUrl);

    let transformed = html;
    transformed = transformed.replace(/<title>.*?<\/title>/i, `<title>${escapedTitle}</title>`);
    transformed = transformed.replace(
      /<meta\s+name=["']description["'].*?>/i,
      `<meta name="description" content="${escapedDesc}" />`
    );
    transformed = transformed.replace(
      /<meta\s+property=["']og:title["'].*?>/i,
      `<meta property="og:title" content="${escapedTitle}" />`
    );
    transformed = transformed.replace(
      /<meta\s+property=["']og:description["'].*?>/i,
      `<meta property="og:description" content="${escapedDesc}" />`
    );
    transformed = transformed.replace(
      /<meta\s+property=["']og:image["'].*?>/i,
      `<meta property="og:image" content="${escapedImg}" />\n    <meta property="og:image:secure_url" content="${escapedImg}" />\n    <meta property="og:image:type" content="image/jpeg" />\n    <meta property="og:image:width" content="600" />\n    <meta property="og:image:height" content="600" />\n    <meta property="og:url" content="${escapedUrl}" />`
    );
    transformed = transformed.replace(
      /<meta\s+name=["']twitter:title["'].*?>/i,
      `<meta name="twitter:title" content="${escapedTitle}" />`
    );
    transformed = transformed.replace(
      /<meta\s+name=["']twitter:description["'].*?>/i,
      `<meta name="twitter:description" content="${escapedDesc}" />`
    );
    transformed = transformed.replace(
      /<meta\s+name=["']twitter:image["'].*?>/i,
      `<meta name="twitter:image" content="${escapedImg}" />`
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(transformed);
  } catch (err) {
    console.error("Error in api/og handler:", err);
    return res.status(500).json({ error: "Failed to generate page metadata" });
  }
}
