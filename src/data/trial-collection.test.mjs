import test from "node:test";
import assert from "node:assert/strict";
import { priceFor } from "./dealer.js";

test("Trial collection: featured prioritizing and ordering", () => {
  const mockProducts = [
    { id: "1", name: "Regular Gas Stove", cat: "gas_stoves", mrp: 5000, img: "stove.png" },
    { id: "2", name: "2B Aria Mini SS GS Sunshine", cat: "gas_stoves", mrp: 6449, isTrial: true, trialOrder: 0, collections: ["trial"] },
    { id: "3", name: "Arrow Plus 2B", cat: "gas_stoves", mrp: 11995, isTrial: true, trialOrder: 1, collections: ["trial"] },
    { id: "4", name: "2B BRIO AUTO SS GS SUNSHINE", cat: "gas_stoves", mrp: 0, isTrial: true, trialOrder: 2, collections: ["trial"] },
    { id: "5", name: "Chimney 60", cat: "chimneys", mrp: 15000, img: "chimney.png" },
  ];

  const trialItems = mockProducts.filter(
    (p) =>
      p.isTrial ||
      p.collections?.includes("trial") ||
      p.cat === "trial" ||
      p.cat?.toLowerCase() === "trial" ||
      (Array.isArray(p.tags) && p.tags.some((t) => typeof t === "string" && t.toLowerCase() === "trial"))
  );

  assert.equal(trialItems.length, 3, "Finds all 3 trial collection products");
  const sorted = [...trialItems].sort((a, b) => (a.trialOrder ?? 999) - (b.trialOrder ?? 999));
  assert.equal(sorted[0].id, "2");
  assert.equal(sorted[1].id, "3");
  assert.equal(sorted[2].id, "4");
});

test("Trial collection: zero-price item conforms to Price on Request rule", () => {
  const brio = {
    id: "4",
    name: "2B BRIO AUTO SS GS SUNSHINE",
    cat: "gas_stoves",
    mrp: 0,
    isTrial: true,
    trialOrder: 2,
    collections: ["trial"],
  };

  const { mrp, isPriceOnRequest } = priceFor(brio);
  assert.equal(isPriceOnRequest, true, "Zero price item must trigger Price on Request");
  assert.equal(mrp, 0);
});

test("Products page filtering: cat=trial matches trial collection items", () => {
  const mockProducts = [
    { id: "1", name: "Regular Gas Stove", cat: "gas_stoves" },
    { id: "2", name: "2B Aria Mini SS GS Sunshine", cat: "gas_stoves", isTrial: true, collections: ["trial"] },
    { id: "3", name: "Arrow Plus 2B", cat: "gas_stoves", isTrial: true, collections: ["trial"] },
    { id: "4", name: "2B BRIO AUTO SS GS SUNSHINE", cat: "gas_stoves", isTrial: true, collections: ["trial"] },
    { id: "5", name: "Chimney 60", cat: "chimneys" },
  ];

  const selectedCats = ["trial"];

  const filtered = mockProducts.filter((p) => {
    if (selectedCats.length > 0) {
      const matchesCat = selectedCats.some(
        (c) => c === p.cat || (c === "trial" && (p.isTrial || p.collections?.includes("trial") || p.cat === "trial"))
      );
      if (!matchesCat) return false;
    }
    return true;
  });

  assert.equal(filtered.length, 3, "Filters exactly to 3 trial collection items");
  assert.deepEqual(filtered.map((p) => p.id), ["2", "3", "4"]);
});
