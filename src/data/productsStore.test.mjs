import test from "node:test";
import assert from "node:assert/strict";

test("cache key generator isolates catalogs by pricebook ID", () => {
  const getCacheKey = (pbId) => pbId ? `shriji.zoho.products.v6:${pbId}` : "shriji.zoho.products.v6:default";

  assert.equal(getCacheKey(null), "shriji.zoho.products.v6:default");
  assert.equal(getCacheKey("pb_wholesale_tier1"), "shriji.zoho.products.v6:pb_wholesale_tier1");
});
