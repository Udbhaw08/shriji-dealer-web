import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceView } from '../src/services/catalog.js';

const CATALOG = [
  { product_id: 'p1', name: 'Mixer 500W', sku: 'MX500', mrp: 2499, dealer_rate: 1899 },
  { product_id: 'p2', name: 'Zero-priced item', sku: 'ZP1', mrp: 0, dealer_rate: null },
  { product_id: 'p3', name: 'Missing price', sku: 'MP1', mrp: null, dealer_rate: 500 },
  { product_id: 'p4', name: 'Dealer-only discount', sku: 'DD1', mrp: 999, dealer_rate: 0 },
];

test('customer gets MRP only — dealer_rate never leaves the server', () => {
  const view = priceView({ role: 'customer', status: 'active' }, CATALOG);
  for (const p of view) {
    assert.equal('dealer_rate' in p, false);
  }
  assert.equal(view[0].mrp, 2499);
});

test('unauthenticated viewer gets MRP only', () => {
  const view = priceView(null, CATALOG);
  for (const p of view) assert.equal('dealer_rate' in p, false);
});

test('pending dealer does not get dealer rates', () => {
  const view = priceView({ role: 'dealer', status: 'pending' }, CATALOG);
  for (const p of view) assert.equal('dealer_rate' in p, false);
});

test('revoked staff does not get dealer rates', () => {
  const view = priceView({ role: 'dealer_staff', status: 'revoked' }, CATALOG);
  for (const p of view) assert.equal('dealer_rate' in p, false);
});

test('active dealer gets dealer rates, with zero → null', () => {
  const view = priceView({ role: 'dealer', status: 'active' }, CATALOG);
  assert.equal(view[0].dealer_rate, 1899);
  assert.equal(view[3].dealer_rate, null); // a ₹0 dealer rate must not ship
  assert.equal(view[2].dealer_rate, null);
});

test('active dealer_staff gets dealer rates when price is not hidden', () => {
  const view = priceView({ role: 'dealer_staff', status: 'active', can_see_dealer_price: true }, CATALOG);
  assert.equal(view[0].dealer_rate, 1899);
});

test('active dealer_staff with can_see_dealer_price: false gets MRP only', () => {
  const view = priceView({ role: 'dealer_staff', status: 'active', can_see_dealer_price: false }, CATALOG);
  assert.equal('dealer_rate' in view[0], false);
  assert.equal(view[0].mrp, 2499);
});

test('active dealer_staff when dealer has hide_staff_dealer_price: true gets MRP only', () => {
  const view = priceView({ role: 'dealer_staff', status: 'active', hide_staff_dealer_price: true }, CATALOG);
  assert.equal('dealer_rate' in view[0], false);
  assert.equal(view[0].mrp, 2499);
});

test('zero/missing mrp is always price_on_request — never ₹0', () => {
  const view = priceView({ role: 'dealer', status: 'active' }, CATALOG);
  assert.equal(view[1].price_on_request, true);
  assert.equal(view[2].price_on_request, true);
  assert.equal(view[0].price_on_request, false);
});

test('dealer rate never exceeds mrp', () => {
  const inflated = [{ product_id: 'x', name: 'X', sku: null, mrp: 100, dealer_rate: 150 }];
  const view = priceView({ role: 'dealer', status: 'active' }, inflated);
  // the catalog service must not present a dealer rate above MRP
  assert.ok(view[0].dealer_rate === null || view[0].dealer_rate <= 100);
});
