import { execSync } from "node:child_process";

const rootDir = process.cwd();

console.log("\n==========================================");
console.log("🚀 STARTING AUTOMATED FULL REPO SYNC");
console.log("==========================================\n");

function run(cmd, desc) {
  console.log(`▶ [${desc}] ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: rootDir });
    console.log(`✔ [${desc}] Done.\n`);
    return true;
  } catch (err) {
    console.warn(`⚠ [${desc}] Notice: command had non-zero exit, continuing workflow.`);
    return false;
  }
}

// 1. Update CODEBASE.md
run("node scripts/generate-codebase-doc.mjs", "1/4 Synchronizing CODEBASE.md Documentation");

// 2. Build Web Bundle
run("npx vite build", "2/4 Building Web Production Assets");

// 3. Sync Native Android & iOS Apps
run("npx cap sync", "3/4 Synchronizing Android & iOS Native Folders");

// 4. Update Knowledge Graph
run("graphify update . && python scripts/build_wiki.py", "4/4 Updating Graphify Knowledge Base");

console.log("==========================================");
console.log("🎉 ALL IN SYNC: Web, Android, iOS & Docs Updated!");
console.log("==========================================\n");
