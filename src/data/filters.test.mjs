import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getProductSize, getProductMotorType } from './filtersHelper.js';

const cacheData = JSON.parse(fs.readFileSync('.products_cache.json', 'utf8'));
const products = cacheData.products;

test('Size extraction accurately detects chimney sizes (60 CM, 75 CM, 90 CM)', () => {
  const sample60 = { name: "60 Amaze Pro CH Sunshine", cat: "chimneys" };
  const sample75 = { name: "Benito 75 Dual Tone", cat: "chimneys" };
  const sample90 = { name: "Anton Max 90 BLDC Heat Auto Clean", cat: "chimneys" };
  const sampleNonChimney = { name: "Sunshine 3 Burner Gas Stove", cat: "gas_stoves" };

  assert.equal(getProductSize(sample60), "60 CM");
  assert.equal(getProductSize(sample75), "75 CM");
  assert.equal(getProductSize(sample90), "90 CM");
  assert.equal(getProductSize(sampleNonChimney), null);
});

test('Motor Type extraction accurately detects BLDC in title and features', () => {
  const bldcTitle = { name: "Anton Max 60 BLDC Heat Auto Clean", cat: "chimneys" };
  const bldcFeature = { name: "Casavo 60 Dual Tone", features: ["BLDC Motor"], cat: "chimneys" };
  const standardChimney = { name: "60 Amaze Pro CH Sunshine", features: [], cat: "chimneys" };

  assert.equal(getProductMotorType(bldcTitle), "BLDC");
  assert.equal(getProductMotorType(bldcFeature), "BLDC");
  assert.equal(getProductMotorType(standardChimney), null);
});

test('Catalog Chimneys: Exactly 66 chimneys partition into 60 CM (32), 75 CM (14), 90 CM (20)', () => {
  const chimneys = products.filter(p => p.cat === 'chimneys' || /chimney/i.test(p.name));
  assert.equal(chimneys.length, 66, "Total chimneys in catalog must be exactly 66");

  const sizeCounts = { '60 CM': 0, '75 CM': 0, '90 CM': 0, other: 0 };
  chimneys.forEach(c => {
    const s = getProductSize(c);
    if (s && sizeCounts[s] !== undefined) sizeCounts[s]++;
    else sizeCounts.other++;
  });

  assert.equal(sizeCounts['60 CM'], 32, "32 Chimneys must be 60 CM");
  assert.equal(sizeCounts['75 CM'], 14, "14 Chimneys must be 75 CM");
  assert.equal(sizeCounts['90 CM'], 20, "20 Chimneys must be 90 CM");
  assert.equal(sizeCounts.other, 0, "No chimneys should have unmatched size");
});

test('Catalog Chimneys: Exactly 20 chimneys have BLDC Motor', () => {
  const chimneys = products.filter(p => p.cat === 'chimneys' || /chimney/i.test(p.name));
  const bldcChimneys = chimneys.filter(c => getProductMotorType(c) === 'BLDC');

  assert.equal(bldcChimneys.length, 20, "Total BLDC chimneys must be exactly 20");

  const bldc60 = bldcChimneys.filter(c => getProductSize(c) === '60 CM');
  const bldc75 = bldcChimneys.filter(c => getProductSize(c) === '75 CM');
  const bldc90 = bldcChimneys.filter(c => getProductSize(c) === '90 CM');

  assert.equal(bldc60.length, 7, "7 BLDC chimneys are 60 CM");
  assert.equal(bldc75.length, 5, "5 BLDC chimneys are 75 CM");
  assert.equal(bldc90.length, 8, "8 BLDC chimneys are 90 CM");
  assert.equal(bldc60.length + bldc75.length + bldc90.length, 20);
});
