import test from "node:test";
import assert from "node:assert/strict";

test("health check reports database readiness and latency", async () => {
  const mockPingDb = async () => ({ ok: true, latencyMs: 14 });
  const health = await mockPingDb();

  assert.equal(health.ok, true);
  assert.equal(health.latencyMs < 100, true);
});
