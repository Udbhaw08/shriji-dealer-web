import test from "node:test";
import assert from "node:assert/strict";

test("validates JSON request body safely", () => {
  const safeParseJson = (raw) => {
    try {
      return { ok: true, data: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: "Invalid JSON format" };
    }
  };

  assert.equal(safeParseJson('{"name":"Shriji"}').ok, true);
  assert.equal(safeParseJson('{"name": invalid}').ok, false);
});
