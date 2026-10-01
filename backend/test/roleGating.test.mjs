import test from "node:test";
import assert from "node:assert/strict";

test("role permissions hierarchy correctly classifies privileges", () => {
  const roles = {
    customer: 10,
    staff: 20,
    dealer: 30,
    admin: 40,
  };

  const hasAccess = (userRole, requiredRole) => (roles[userRole] || 0) >= (roles[requiredRole] || 0);

  assert.equal(hasAccess("admin", "dealer"), true);
  assert.equal(hasAccess("dealer", "staff"), true);
  assert.equal(hasAccess("staff", "customer"), true);
  assert.equal(hasAccess("customer", "dealer"), false);
});
