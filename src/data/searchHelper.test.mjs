import test from "node:test";
import assert from "node:assert/strict";

test("search query normalization trims and lowercases input", () => {
  const normalize = (q) => (q || "").trim().toLowerCase();
  assert.equal(normalize("  Gas Stove  "), "gas stove");
  assert.equal(normalize("CHIMNEY"), "chimney");
  assert.equal(normalize(null), "");
});

test("product keyword search matches titles and tags accurately", () => {
  const products = [
    { id: "1", title: "Smart Auto Ignition 3 Burner Gas Stove", category: "gas_stoves", tags: ["bestseller"] },
    { id: "2", title: "Curved Glass Kitchen Chimney 60cm", category: "chimneys", tags: ["filterless"] },
  ];
  const query = "chimney";
  const results = products.filter(p => p.title.toLowerCase().includes(query) || p.tags.includes(query));
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "2");
});
