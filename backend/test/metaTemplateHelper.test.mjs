import test from "node:test";
import assert from "node:assert/strict";

test("formats Meta WhatsApp authentication template payload correctly", () => {
  const buildPayload = (phone, otp) => ({
    messaging_product: "whatsapp",
    to: `91${phone}`,
    type: "template",
    template: {
      name: "auth_otp",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: otp }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  });

  const payload = buildPayload("9820012345", "456789");
  assert.equal(payload.to, "919820012345");
  assert.equal(payload.template.components[0].parameters[0].text, "456789");
});
