export function requireEnv(keys, env = process.env) {
  const missing = keys.filter(k => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Fatal configuration error: missing required environment variables: ${missing.join(", ")}`);
  }
}
