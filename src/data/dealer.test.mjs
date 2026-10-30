/* node src/data/dealer.test.mjs */
import assert from "node:assert/strict";
import { DEALERS, dealerById, inr, isDealer, priceFor, tierOf, viewerFor, shareLink, slugifyProduct } from "./dealer.js";

const TEST_PRODUCTS = [
  { id: "test-stove-1", name: "Test 3B Gas Stove", mrp: 4999 },
  { id: "test-chimney-2", name: "Test 60 Chimney", mrp: 12999 },
];

for (const p of TEST_PRODUCTS) {
  const guest = priceFor(p);
  assert.deepEqual(guest, priceFor(p), `${p.id}: price must be stable`);
  assert.equal(guest.mrp % 100, 99, `${p.id}: MRP should end in 99`);

  // A viewer with no dealer contract pays MRP — no accidental discount for guests.
  assert.equal(guest.dealer, guest.mrp, `${p.id}: guest price must equal MRP`);
  assert.equal(guest.rebatePct, 0, `${p.id}: guest gets no rebate`);

  for (const d of DEALERS) {
    const a = priceFor(p, d);
    assert.equal(a.mrp, guest.mrp, `${p.id}: MRP must not vary by dealer`);
    assert.ok(a.dealer < a.mrp, `${p.id}/${d.id}: dealer price must beat MRP`);
    assert.ok(a.dealer > 0 && Number.isInteger(a.dealer), `${p.id}/${d.id}: price must be a positive integer`);
    assert.equal(a.rebatePct, d.rebatePct, `${p.id}/${d.id}: rebate must come from the dealer`);
  }
}

// Two dealers on different rebates must not see the same number.
const [a, b] = DEALERS;
assert.notEqual(priceFor(TEST_PRODUCTS[0], a).dealer, priceFor(TEST_PRODUCTS[0], b).dealer);

assert.equal(dealerById("nope"), null);
assert.equal(dealerById(null), null);
assert.equal(dealerById(a.id).name, a.name);
assert.equal(inr(8999), "₹8,999");

/* ---- who may see a dealer price ---- */

const approved = { role: "dealer", status: "approved", dealerId: a.id };
const incognitoDealer = { role: "dealer", status: "approved", dealerId: a.id, isIncognito: true };
const pending = { role: "dealer", status: "pending", shop: "New Shop" };
const customer = { role: "customer" };
const guest = { role: "guest" };

assert.ok(isDealer(approved));
assert.ok(!isDealer(incognitoDealer), "incognito mode must temporarily deactivate isDealer");
assert.ok(!isDealer(pending), "a pending application must not unlock pricing");
assert.ok(!isDealer(customer));
assert.ok(!isDealer(guest));
assert.ok(!isDealer(null));

assert.equal(tierOf(approved), "dealer");
assert.equal(tierOf(pending), "guest");
assert.equal(tierOf(customer), "customer");
assert.equal(tierOf(guest), "guest");

// Only a signed-in approved dealer with no share token gets the dealer view.
assert.equal(viewerFor(approved, null).customerView, false);
assert.equal(viewerFor(incognitoDealer, null).customerView, true, "incognito mode forces customerView");
assert.equal(viewerFor(incognitoDealer, null).me, null, "incognito mode hides dealer me identity");
assert.equal(viewerFor(pending, null).customerView, true);
assert.equal(viewerFor(customer, null).customerView, true);
assert.equal(viewerFor(guest, null).customerView, true);

// A shared link is a customer link for everyone - including its own sender.
assert.equal(viewerFor(approved, a.id).customerView, true, "a dealer opening their own link sees the customer view");
assert.equal(viewerFor(approved, b.id).customerView, true);
assert.equal(viewerFor(guest, a.id).customerView, true);
assert.equal(viewerFor(guest, a.id).sharedBy.name, a.name, "the customer sees which dealer shared it");
assert.equal(viewerFor(guest, "SD-9999").sharedBy, null, "an unknown dealer id must not break the page");

/* ---- slugify & shareLink ---- */
assert.equal(
  slugifyProduct("Sunshine Shine Rhombus 4 Burner Hobtop Gas Stove Manual Auto Ignition"),
  "sunshine-shine-rhombus-4-burner-hobtop-gas-stove-manual-auto-ignition",
  "generates clean SEO product slug"
);

const link = shareLink(TEST_PRODUCTS[0], a);
assert.ok(link.includes("/products/test-3b-gas-stove"), `link should contain product slug: ${link}`);
assert.ok(link.includes("pid=test-stove-1"), `link should contain pid: ${link}`);
assert.ok(link.includes(`from=${a.id}`), `link should contain from: ${link}`);
assert.ok(link.includes(a.name.replace(/\s+/g, "+")) || link.includes(encodeURIComponent(a.name)), `link should contain dealer name: ${link}`);
assert.ok(link.includes(a.state.replace(/\s+/g, "+")) || link.includes(encodeURIComponent(a.state)), `link should contain dealer state: ${link}`);

const paramsWithState = new URLSearchParams({ from: "SD-4587", state: "Delhi", name: "Custom Dealer" });
const viewWithState = viewerFor(guest, "SD-4587", paramsWithState);
assert.equal(viewWithState.sharedBy.state, "Delhi", "viewerFor captures dealer state");

console.log(`ok — ${TEST_PRODUCTS.length} test products × ${DEALERS.length} dealers priced & shareLink verified`);
