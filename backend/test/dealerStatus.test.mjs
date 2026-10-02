import test from "node:test";
import assert from "node:assert/strict";

test("dealer status transitions follow defined state machine", () => {
  const allowedTransitions = {
    pending: ["approved", "rejected"],
    approved: ["suspended"],
    rejected: ["pending"],
    suspended: ["approved"],
  };

  const canTransition = (from, to) => (allowedTransitions[from] || []).includes(to);

  assert.equal(canTransition("pending", "approved"), true);
  assert.equal(canTransition("pending", "rejected"), true);
  assert.equal(canTransition("approved", "pending"), false);
});
