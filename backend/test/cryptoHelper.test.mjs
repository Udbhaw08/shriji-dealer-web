import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

test("hashes OTP with SHA-256 securely", () => {
  const hashOtp = (phone, otp, salt = "shriji-salt") => {
    return crypto.createHmac("sha256", salt).update(`${phone}:${otp}`).digest("hex");
  };

  const hash1 = hashOtp("9820012345", "123456");
  const hash2 = hashOtp("9820012345", "123456");
  const hash3 = hashOtp("9820012345", "654321");

  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});
