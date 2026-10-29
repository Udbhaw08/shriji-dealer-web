#!/usr/bin/env node
import { syncProductDetailsPool } from "../api/_lib/zoho.js";

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const batchSize = limitIdx !== -1 && args[limitIdx + 1] ? Number(args[limitIdx + 1]) : 25;
  const force = args.includes("--force");
  const delayIdx = args.indexOf("--delay");
  const delayMs = delayIdx !== -1 && args[delayIdx + 1] ? Number(args[delayIdx + 1]) : 200;

  console.log(`🔄 [sync-product-details] Starting Zoho Commerce product details pool sync...`);
  console.log(`   Batch size: ${batchSize} | Force: ${force} | Pacing delay: ${delayMs}ms`);

  const startTime = Date.now();
  const res = await syncProductDetailsPool({ batchSize, force, delayMs });
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ [sync-product-details] Pool sync completed in ${duration}s!`);
  console.log(`   Synced: ${res.synced} products`);
  console.log(`   Remaining in catalog pool: ${res.remaining} products`);
  console.log(`   Total active products: ${res.total}`);
}

main().catch((err) => {
  console.error(`❌ [sync-product-details] Failed:`, err);
  process.exit(1);
});
