/* node src/data/pricing.test.mjs */
import assert from "node:assert/strict";
import { inr, priceFor } from "./dealer.js";

console.log("Running Pricing Regression Test Suite...");

// 1. Protection against synthetic hash prices on unpriced / ₹0 products
const zeroItem = {
  id: "3334672000000194768",
  name: "10L LP GY Jyoti",
  mrp: 0,
};

const zeroPricedResult = priceFor(zeroItem);
assert.equal(zeroPricedResult.mrp, 0, "Unpriced product must have mrp: 0 (no hash fallback!)");
assert.equal(zeroPricedResult.dealer, 0, "Unpriced product must have dealer: 0");
assert.equal(zeroPricedResult.isPriceOnRequest, true, "isPriceOnRequest must be true when mrp is 0");
assert.equal(inr(zeroPricedResult.mrp), "Price on Request", "inr(0) must format as 'Price on Request'");

// 2. Real product pricing verification
const kettle = {
  id: "3334672000000194828",
  name: "1.8L Electric Kettle SA KuchenBau",
  mrp: 2999,
  dealerRate: 1025,
};

const kettleGuest = priceFor(kettle);
assert.equal(kettleGuest.mrp, 2999, "Customer MRP for kettle must be 2999");
assert.equal(kettleGuest.dealer, 2999, "Guest/customer gets MRP with no dealer discount");
assert.equal(kettleGuest.rebatePct, 0);
assert.equal(inr(kettleGuest.mrp), "₹2,999");

const kettleDealer = priceFor(kettle, { id: "cust_dealer_1", rebatePct: 20 });
assert.equal(kettleDealer.mrp, 2999, "Kettle MRP stays 2999 for dealer");
assert.equal(kettleDealer.dealer, 1025, "Kettle dealer rate must be 1025 as fetched from Zoho Commerce API");

// 3. Label Price vs Selling Price priority regression check
// When Selling Price is 0 but Label Price is set (e.g. 3B Verna Plus GS Sunshine)
const vernaPlus = {
  id: "3334672000000840431",
  name: "3B Verna Plus GS Sunshine",
  mrp: 16395,
  sellingPrice: 0,
  labelPrice: 16395,
};

const vernaGuest = priceFor(vernaPlus);
assert.equal(vernaGuest.mrp, 16395, "Should correctly pick label rate 16395 when selling price is 0");
assert.equal(inr(vernaGuest.mrp), "₹16,395");

// 4. Exact dealer pricebook rate test (e.g. 3B Crystal BK HT Sunshine)
const crystal = {
  id: "3334672000000839771",
  name: "3B Crystal BK HT Sunshine",
  mrp: 22895,
  dealerRate: 8550,
};

const crystalGuest = priceFor(crystal);
assert.equal(crystalGuest.mrp, 22895, "Guest sees full retail MRP 22895 for Crystal 3B");
assert.equal(crystalGuest.dealer, 22895);
assert.equal(crystalGuest.rebatePct, 0);

const crystalDealer = priceFor(crystal, { id: "cust_hello", rebatePct: 20 });
assert.equal(crystalDealer.mrp, 22895, "Crystal 3B MRP remains 22895");
assert.equal(crystalDealer.dealer, 8550, "Crystal 3B dealer price must be exactly ₹8,550 from Zoho Commerce API!");
assert.equal(crystalDealer.rebatePct, 63, "Crystal 3B rebate percentage is 63% off MRP");

// 5. Product without specific pricebook rate falls back to contracted rebate
const genericItem = {
  id: "generic-1",
  name: "Generic 2B Gas Stove",
  mrp: 5000,
};

const genericGuest = priceFor(genericItem);
assert.equal(genericGuest.mrp, 5000);
assert.equal(genericGuest.dealer, 5000);

const genericDealer = priceFor(genericItem, { id: "cust_dealer_1", rebatePct: 20 });
assert.equal(genericDealer.mrp, 5000);
assert.equal(genericDealer.dealer, 3999, "Falls back to 20% rebate price99 when no specific pricebook rate exists");
assert.equal(genericDealer.rebatePct, 20);

console.log("✓ All pricing regression tests PASSED successfully.");
