import { execSync } from "child_process";

console.log("Running repository verification...");
try {
  execSync("npm test", { stdio: "inherit" });
  console.log("✓ All repository tests verified successfully.");
} catch (e) {
  console.error("Verification failed:", e.message);
  process.exit(1);
}
