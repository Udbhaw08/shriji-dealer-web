/* Dealers + pricing.
 *
 * ponytail: every number below is generated from the product id, so the demo is
 * stable across reloads without a backend. This file is the ONLY seam — when
 * Zoho Commerce is wired, replace `priceFor` and `DEALERS` with the API call and
 * the signed-in dealer; nothing else in the app reads prices.
 */

/* Sample dealer directory. In production these are Zoho contacts. */
export const DEALERS = [
  {
    id: "DE-BKV-8180",
    dealerId: "fa0e9ef4-29d5-4816-9e22-c3fefee354be",
    name: "ownershop",
    person: "Owner",
    city: "Delhi",
    state: "Delhi",
    address: "delhi - 110092",
    phone: "+91 88268 67932",
    phoneRaw: "918826867932",
    tier: "Verified Dealer",
    status: "approved",
    price_tier: "MH Dist Basic Oct 2026",
    pricebookId: "3334672000001355803",
    rebatePct: 22,
    gst_number: "27AJHPJ2192C1ZF",
    gst_treatment: "Registered Business - Regular",
    zoho_account_id: "928463000001716004",
  },
  {
    id: "SD-2210",
    dealerId: "cf0cea60-d5e9-4b01-9fbf-8df7814e8ce7",
    name: "Rajesh Appliances",
    person: "Rajesh Mehta",
    city: "Borivali East, Mumbai",
    state: "Maharashtra",
    phone: "+91 98201 44556",
    phoneRaw: "919820144556",
    tier: "Verified Dealer",
    status: "approved",
    rebatePct: 19,
  },
];

export const dealerById = (id) =>
  DEALERS.find(
    (d) =>
      d.id === id ||
      d.dealerId === id ||
      d.phoneRaw === id ||
      (typeof id === "string" && id.includes("8826") && d.phoneRaw.includes("8826"))
  ) || null;

export function registerDealer(d) {
  if (!d || !d.id) return;
  const idx = DEALERS.findIndex((item) => item.id === d.id);
  if (idx >= 0) DEALERS[idx] = { ...DEALERS[idx], ...d };
  else DEALERS.push(d);
}

/** The signed-in dealer in the demo. Replaced by the real session after Zoho. */
export const ACCOUNT = DEALERS[0];

// Realistic MRP bands per category (INR), used only to generate sample pricing.
const BAND = {
  gas_stoves: [2490, 12990],
  hobs: [8990, 34990],
  hob_tops: [6990, 24990],
  chimneys: [9990, 44990],
  small_appliances: [499, 4990],
};

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// ₹8,999 reads like a price; ₹8,943 does not.
const price99 = (n) => (n <= 0 ? 0 : Math.max(99, Math.round(n / 100) * 100 - 1));

/**
 * Zoho keeps a price list per audience.
 * Customers pay MRP (from Zoho Commerce store API).
 * Approved dealers get their live assigned Zoho Commerce Pricebook rate, or standard rebate.
 * Unpriced products (mrp === 0) cleanly report Price on Request with no synthetic numbers.
 *
 * @param {object} p product
 * @param {object} [dealer] the dealer whose contract applies, if any
 */
export function priceFor(p, dealer) {
  const mrp = typeof p?.mrp === "number" && !isNaN(p.mrp) ? p.mrp : 0;
  const rebatePct = dealer ? (dealer.rebatePct || 20) : 0;
  const hasLiveDealerRate = typeof p?.dealerRate === "number" && p.dealerRate > 0;

  let dealerNet;
  if (!dealer) {
    // Customers only see retail MRP
    dealerNet = mrp;
  } else if (hasLiveDealerRate) {
    // Exact custom wholesale rate directly from Zoho Commerce Pricebook API
    dealerNet = p.dealerRate;
  } else if (mrp > 0) {
    // Fallback to standard contracted dealer rebate from MRP
    dealerNet = price99(mrp * (1 - rebatePct / 100));
  } else {
    dealerNet = 0;
  }

  const isDealerPriceOnRequest = !dealer ? mrp <= 0 : dealerNet <= 0;
  const isCustomerPriceOnRequest = mrp <= 0;

  const rebate = dealer
    ? (hasLiveDealerRate && mrp > 0 && dealerNet < mrp
        ? Math.round(((mrp - dealerNet) / mrp) * 100)
        : rebatePct)
    : 0;

  return {
    mrp,
    dealer: dealerNet,
    rebatePct: rebate,
    isPriceOnRequest: isDealerPriceOnRequest,
    isCustomerPriceOnRequest,
  };
}

/** Bestseller / New / Premium ribbon, as on the mockup. Sample data. */
export function tagFor(p) {
  const h = hash(p.id);
  if (h % 11 === 0) return { label: "New", kind: "ok" };
  if (h % 7 === 0) return { label: "Bestseller", kind: "ok" };
  if (priceFor(p).mrp > (BAND[p.cat] || [0, 1])[1] * 0.72) return { label: "Premium", kind: "blue" };
  return null;
}

export const inr = (n) => {
  if (typeof n !== "number" || n <= 0) return "Price on Request";
  return `₹${n.toLocaleString("en-IN")}`;
};

/** The one check that gates dealer pricing. Pending applicants do not pass. */
export function isDealer(session) {
  return Boolean(session) && session.role === "dealer" && session.status === "approved";
}

/** Which Zoho price list applies to this viewer. */
export function tierOf(session) {
  if (isDealer(session)) return "dealer";
  if (session && session.role === "customer") return "customer";
  return "guest";
}

/** Format a phone number into valid international WhatsApp format (e.g. 919820012345) */
export function formatWhatsAppPhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

/**
 * Convert any product name or model string into a clean, URL-safe slug.
 * Mirrors modern e-commerce URL slugs (e.g. sunshineindia.com).
 */
export function slugifyProduct(nameOrProduct) {
  if (!nameOrProduct) return "";
  const str = typeof nameOrProduct === "string"
    ? nameOrProduct
    : (nameOrProduct.name || nameOrProduct.model || "");
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Return the canonical URL slug for a product object.
 */
export function productSlug(p) {
  if (!p) return "";
  if (p.slug) return p.slug;
  return slugifyProduct(p.name || p.model) || p.id || "";
}

/**
 * Who is looking, and at which view. The single rule that decides whether a
 * dealer price may be rendered at all.
 *
 * A ?from= share token forces the customer view for EVERYONE, including the
 * dealer who sent the link — otherwise a customer opening a dealer's own device
 * or a forwarded session would see trade pricing.
 */
export function viewerFor(session, fromId, searchParams) {
  let sharedBy = dealerById(fromId);
  const paramPhone = searchParams?.get ? (searchParams.get("phone") || searchParams.get("dealerPhone") || "") : "";
  const paramName = searchParams?.get ? (searchParams.get("name") || searchParams.get("dealerName") || "") : "";
  const paramCity = searchParams?.get ? (searchParams.get("city") || searchParams.get("dealerCity") || "") : "";
  const paramState = searchParams?.get ? (searchParams.get("state") || searchParams.get("dealerState") || "") : "";
  const paramPerson = searchParams?.get ? (searchParams.get("person") || "") : "";

  if (paramPhone || paramName) {
    sharedBy = {
      id: fromId || sharedBy?.id || "dealer",
      name: paramName || sharedBy?.name || "Authorised Dealer",
      person: paramPerson || sharedBy?.person || "",
      phone: paramPhone || sharedBy?.phone || "",
      phoneRaw: formatWhatsAppPhone(paramPhone || sharedBy?.phoneRaw || sharedBy?.phone || ""),
      city: paramCity || sharedBy?.city || "Mumbai",
      state: paramState || sharedBy?.state || "",
      tier: "Verified Dealer",
      rebatePct: sharedBy?.rebatePct || 20,
    };
    registerDealer(sharedBy);
  } else if (sharedBy) {
    sharedBy = {
      ...sharedBy,
      phoneRaw: formatWhatsAppPhone(sharedBy.phoneRaw || sharedBy.phone),
    };
  }

  const me = isDealer(session)
    ? { ...(dealerById(session?.dealerId) || {}), ...(session?.dealer || {}) }
    : null;

  return { sharedBy, me, customerView: Boolean(fromId) || Boolean(sharedBy) || !me };
}

/**
 * The link a dealer hands a customer.
 * Uses a clean product slug (e.g. /products/sunshine-shine-rhombus-4-burner-hobtop-gas-stove-manual-auto-ignition)
 * with dealer name, state, city, and phone encoded as search parameters.
 */
export function shareLink(p, dealer) {
  if (!p) return "";
  const isLocal = typeof window !== "undefined" && (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1");
  const origin = (typeof window !== "undefined" && window.location?.origin && !isLocal)
    ? window.location.origin
    : "https://restor.in";
  const slug = productSlug(p) || p.id;
  const url = new URL(`/products/${slug}`, origin);

  if (p.id) {
    url.searchParams.set("pid", p.id);
  }

  if (dealer) {
    if (dealer.id) url.searchParams.set("from", dealer.id);
    const name = dealer.name || dealer.shop || "";
    if (name) url.searchParams.set("name", name);
    const state = dealer.state || "";
    if (state) url.searchParams.set("state", state);
    const city = dealer.city || "";
    if (city) url.searchParams.set("city", city);
    const phone = dealer.phone || dealer.phoneRaw || "";
    if (phone) url.searchParams.set("phone", phone);
  }
  return url.toString();
}
