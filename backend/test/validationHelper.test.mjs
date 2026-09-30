import test from "node:test";
import assert from "node:assert/strict";

test("validates Indian GSTIN 15-character format correctly", () => {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  assert.equal(gstinRegex.test("27AAACG9876A1Z5"), true);
  assert.equal(gstinRegex.test("INVALID_GSTIN"), false);
  assert.equal(gstinRegex.test("27AAACG9876A1"), false);
});

test("validates Indian 6-digit PIN code correctly", () => {
  const pinRegex = /^[1-9][0-9]{5}$/;
  assert.equal(pinRegex.test("400001"), true);
  assert.equal(pinRegex.test("110001"), true);
  assert.equal(pinRegex.test("000001"), false);
  assert.equal(pinRegex.test("40000"), false);
});
