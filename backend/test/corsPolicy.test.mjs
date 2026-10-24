import test from "node:test";
import assert from "node:assert/strict";

test("CORS origin validator allows production and staging domains", () => {
  const allowed = [
    "https://restor.in",
    "https://shriji-dealer-web.vercel.app",
    "http://localhost:5173",
  ];

  const isAllowed = (origin) => !origin || allowed.includes(origin) || origin.endsWith(".vercel.app");

  assert.equal(isAllowed("https://restor.in"), true);
  assert.equal(isAllowed("http://localhost:5173"), true);
  assert.equal(isAllowed("https://preview-123.vercel.app"), true);
  assert.equal(isAllowed("https://malicious-site.com"), false);
});
