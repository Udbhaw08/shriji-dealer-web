import fs from "node:fs";
import path from "node:path";
import { fetchZohoProductById } from "./zoho.js";

/**
 * Serverless handler for product pages on Vercel.
 * Dynamically injects Open Graph meta tags (og:title, og:image, og:description)
 * so that WhatsApp, Telegram, Facebook, and Twitter crawlers render rich previews
 * with the product image and dealer details.
 */
export default async function handler(req, res) {
  try {
    const { slug, pid, name, city, state } = req.query || {};
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

    const dealerName = name || "";
    const dealerCity = city || "";
    const dealerState = state || "";
    const dealerLoc = [dealerCity, dealerState].filter(Boolean).join(", ");
    const priceStr = product.mrp > 0 ? `₹${Number(product.mrp).toLocaleString("en-IN")}` : "Price on Request";

    const title = `${product.name} · Sunshine Appliances`;
    const desc = dealerName
      ? `Retail MRP: ${priceStr} (Incl. of all taxes) · Available with ${dealerName}${dealerLoc ? ` (${dealerLoc})` : ""}`
      : `Retail MRP: ${priceStr} (Incl. of all taxes) · Sunshine ReSTOR`;

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "shriji-dealer-web.vercel.app";
    const imgUrl = product.img || `${proto}://${host}/img/hero-stove.webp`;
    const currentUrl = `${proto}://${host}${req.url}`;

    let transformed = html;
    transformed = transformed.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    transformed = transformed.replace(
      /<meta\s+name=["']description["'].*?>/i,
      `<meta name="description" content="${desc}" />`
    );
    transformed = transformed.replace(
      /<meta\s+property=["']og:title["'].*?>/i,
      `<meta property="og:title" content="${title}" />`
    );
    transformed = transformed.replace(
      /<meta\s+property=["']og:description["'].*?>/i,
      `<meta property="og:description" content="${desc}" />`
    );
    transformed = transformed.replace(
      /<meta\s+property=["']og:image["'].*?>/i,
      `<meta property="og:image" content="${imgUrl}" />\n    <meta property="og:image:secure_url" content="${imgUrl}" />\n    <meta property="og:image:type" content="image/jpeg" />\n    <meta property="og:image:width" content="600" />\n    <meta property="og:image:height" content="600" />\n    <meta property="og:url" content="${currentUrl}" />`
    );
    transformed = transformed.replace(
      /<meta\s+name=["']twitter:title["'].*?>/i,
      `<meta name="twitter:title" content="${title}" />`
    );
    transformed = transformed.replace(
      /<meta\s+name=["']twitter:description["'].*?>/i,
      `<meta name="twitter:description" content="${desc}" />`
    );
    transformed = transformed.replace(
      /<meta\s+name=["']twitter:image["'].*?>/i,
      `<meta name="twitter:image" content="${imgUrl}" />`
    );

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(transformed);
  } catch (err) {
    console.error("Error in api/og handler:", err);
    return res.status(500).json({ error: err.message });
  }
}
