import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

test("constant time token comparison prevents timing attacks", () => {
  const bufA = Buffer.from("secret_token_12345");
  const bufB = Buffer.from("secret_token_12345");
  const bufC = Buffer.from("secret_token_diff_");

  assert.equal(crypto.timingSafeEqual(bufA, bufB), true);
  assert.equal(crypto.timingSafeEqual(bufA, bufC), false);
});
