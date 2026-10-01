import test from "node:test";
import assert from "node:assert/strict";

test("formats error response safely for production", () => {
  const formatError = (err, isProd = true) => {
    return {
      ok: false,
      error: isProd ? "An internal server error occurred." : err.message,
      correlationId: "req_test_123",
    };
  };

  const internalErr = new Error("Database connection secret leaked");
  const response = formatError(internalErr, true);

  assert.equal(response.ok, false);
  assert.equal(response.error, "An internal server error occurred.");
  assert.equal(response.correlationId, "req_test_123");
});
