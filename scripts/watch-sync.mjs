import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "src");

console.log("\n==========================================");
console.log("👀 AUTO-SYNC WATCHER ACTIVE");
console.log("Monitoring src/ for any code changes...");
console.log("Any file edit will automatically update Docs, Android & iOS.");
console.log("==========================================\n");

let debounceTimer = null;
let isSyncing = false;

function triggerSync(filename) {
  if (isSyncing) return;
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    isSyncing = true;
    console.log(`\n⚡ Change detected in: ${filename}`);
    console.log("Running automatic sync for Web, Android, iOS & Docs...\n");

    try {
      execSync("node scripts/sync-all.mjs", { stdio: "inherit", cwd: rootDir });
    } catch (err) {
      console.error("Sync error:", err.message);
    } finally {
      isSyncing = false;
      console.log("\n👀 Watching for next change...");
    }
  }, 2500); // 2.5s debounce to batch multi-line edits
}

try {
  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.includes("node_modules") || filename.includes(".git") || filename.includes("dist")) return;
    triggerSync(filename);
  });
} catch (err) {
  console.error("Watcher initialization error:", err);
}
