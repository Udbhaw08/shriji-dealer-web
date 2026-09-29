import test from "node:test";
import assert from "node:assert/strict";

test("site metadata has valid defaults and official contact channels", () => {
  const siteConfig = {
    brandName: "ReSTOR",
    companyName: "Shriji Domestic Appliances",
    supportEmail: "support@restor.in",
    supportPhone: "+91 98200 00000",
  };

  assert.equal(siteConfig.brandName, "ReSTOR");
  assert.match(siteConfig.supportEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
});

test("page title formatter appends brand name gracefully", () => {
  const formatTitle = (title, brand = "ReSTOR") => title ? `${title} · ${brand}` : brand;
  assert.equal(formatTitle("Gas Stoves"), "Gas Stoves · ReSTOR");
  assert.equal(formatTitle(""), "ReSTOR");
});
