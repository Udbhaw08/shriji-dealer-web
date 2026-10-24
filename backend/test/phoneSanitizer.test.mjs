import test from "node:test";
import assert from "node:assert/strict";

test("phone sanitizer standardizes raw input to 10-digit Indian numbers", () => {
  const cleanPhone = (phone) => {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
    if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return digits.slice(2);
    return null;
  };

  assert.equal(cleanPhone("+91 98200 12345"), "9820012345");
  assert.equal(cleanPhone("09820012345"), null);
  assert.equal(cleanPhone("9820012345"), "9820012345");
  assert.equal(cleanPhone("1234567890"), null); // Invalid starting digit
});
