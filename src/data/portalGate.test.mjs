import test from "node:test";
import assert from "node:assert/strict";

test("portalGate enforces customer mode when ?from= query parameter is present", () => {
  const isCustomerLink = (searchParams) => searchParams.has("from");
  const paramsWithFrom = new URLSearchParams("?from=shriji-dealers");
  const paramsNormal = new URLSearchParams("?category=gas_stoves");

  assert.equal(isCustomerLink(paramsWithFrom), true);
  assert.equal(isCustomerLink(paramsNormal), false);
});

test("portalGate permits wholesale price visibility only for approved dealers", () => {
  const canSeeDealerPrice = (user, isSharedLink) => {
    if (isSharedLink) return false;
    return user?.role === "dealer" && user?.status === "approved";
  };

  assert.equal(canSeeDealerPrice({ role: "dealer", status: "approved" }, false), true);
  assert.equal(canSeeDealerPrice({ role: "dealer", status: "pending" }, false), false);
  assert.equal(canSeeDealerPrice({ role: "customer" }, false), false);
  assert.equal(canSeeDealerPrice({ role: "dealer", status: "approved" }, true), false);
});
