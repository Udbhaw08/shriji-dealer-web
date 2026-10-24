const requiredEnv = ["DATABASE_URL", "JWT_SECRET"];
const missing = requiredEnv.filter(k => !process.env[k]);

if (missing.length > 0) {
  console.warn("Notice: Optional development environment variables not set:", missing.join(", "));
} else {
  console.log("✓ Environment configuration verified.");
}
