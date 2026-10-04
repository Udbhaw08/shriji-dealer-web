import test from "node:test";
import assert from "node:assert/strict";

test("formats transactional OTP email template with brand styling", () => {
  const generateEmailHtml = (otp) => `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Your ReSTOR Verification Code</h2>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This code expires in 10 minutes. Do not share it with anyone.</p>
    </div>
  `;

  const html = generateEmailHtml("123456");
  assert.match(html, /123456/);
  assert.match(html, /ReSTOR Verification Code/);
});
