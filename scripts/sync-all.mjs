import { execSync } from "node:child_process";

const rootDir = process.cwd();
const isVercel = Boolean(process.env.VERCEL);

console.log("\n==========================================");
console.log("🚀 STARTING AUTOMATED FULL REPO SYNC");
console.log("==========================================\n");

function run(cmd, desc, { fatal = false } = {}) {
  console.log(`▶ [${desc}] ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: rootDir });
    console.log(`✔ [${desc}] Done.\n`);
    return true;
  } catch (err) {
    if (fatal) {
      console.error(`✖ [${desc}] Failed with non-zero exit code.`);
      process.exit(1);
    }
    console.warn(`⚠ [${desc}] Notice: command had non-zero exit, continuing workflow.`);
    return false;
  }
}

// If building on Vercel, build web production assets directly and skip mobile/local tooling
if (isVercel) {
  console.log("ℹ Running on Vercel: building web production assets directly.");
  run("npx vite build", "Building Web Production Assets", { fatal: true });
  console.log("==========================================");
  console.log("🎉 VERCEL BUILD COMPLETE: Web Assets Ready!");
  console.log("==========================================\n");
  process.exit(0);
}

// 1. Run Unit Tests & Reference Safety Checks (Fatal if broken)
run("npm test", "1/5 Running Unit Tests & Reference Safety Checks", { fatal: true });

// 2. Update CODEBASE.md
run("node scripts/generate-codebase-doc.mjs", "2/5 Synchronizing CODEBASE.md Documentation");

// 3. Build Web Bundle (Fatal if it fails)
run("npx vite build", "3/5 Building Web Production Assets", { fatal: true });

// 4. Sync Native Android & iOS Apps
run("npx cap sync", "4/5 Synchronizing Android & iOS Native Folders");

// 5. Update Knowledge Graph
run("graphify update . && python scripts/build_wiki.py", "5/5 Updating Knowledge Graph");

console.log("==========================================");
console.log("🎉 ALL IN SYNC: Web, Android, iOS & Docs Updated!");
console.log("==========================================\n");
