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
    id: "SD-4587",
    name: "Shah Electronics",
    person: "Kunal Shah",
    city: "Andheri West, Mumbai",
    phone: "+91 98200 12345",
    phoneRaw: "919820012345",
    tier: "Verified Dealer",
    rebatePct: 22,
  },
  {
    id: "SD-2210",
    name: "Rajesh Appliances",
    person: "Rajesh Mehta",
    city: "Borivali East, Mumbai",
    phone: "+91 98201 44556",
    phoneRaw: "919820144556",
    tier: "Verified Dealer",
    rebatePct: 19,
  },
];

export const dealerById = (id) => DEALERS.find((d) => d.id === id) || null;

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
const price99 = (n) => Math.max(99, Math.round(n / 100) * 100 - 1);

/**
 * Zoho keeps a price list per audience. Until it is wired, guests and logged-in
 * customers both pay MRP; only an approved dealer gets a rebate.
 * @param {object} p product
 * @param {object} [dealer] the dealer whose contract applies, if any
 */
export function priceFor(p, dealer) {
  const [lo, hi] = BAND[p.cat] || [999, 9999];
  const mrp = price99(lo + (hash(p.id) % (hi - lo)));
  const rebatePct = dealer ? dealer.rebatePct : 0;
  return { mrp, dealer: price99(mrp * (1 - rebatePct / 100)), rebatePct };
}

/** Bestseller / New / Premium ribbon, as on the mockup. Sample data. */
export function tagFor(p) {
  const h = hash(p.id);
  if (h % 11 === 0) return { label: "New", kind: "ok" };
  if (h % 7 === 0) return { label: "Bestseller", kind: "ok" };
  if (priceFor(p).mrp > (BAND[p.cat] || [0, 1])[1] * 0.72) return { label: "Premium", kind: "blue" };
  return null;
}

export const inr = (n) => `₹${n.toLocaleString("en-IN")}`;

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

/**
 * Who is looking, and at which view. The single rule that decides whether a
 * dealer price may be rendered at all.
 *
 * A ?from= share token forces the customer view for EVERYONE, including the
 * dealer who sent the link — otherwise a customer opening a dealer's own device
 * or a forwarded session would see trade pricing.
 */
export function viewerFor(session, fromId) {
  const sharedBy = dealerById(fromId);
  const me = isDealer(session) ? (dealerById(session?.dealerId) || session?.dealer || null) : null;
  return { sharedBy, me, customerView: Boolean(sharedBy) || !me };
}

/** The link a dealer hands a customer. Always opens the customer view. */
export function shareLink(p, dealer) {
  const url = new URL(`/products/${p.id}`, window.location.origin);
  if (dealer) url.searchParams.set("from", dealer.id);
  return url.toString();
}
