export async function getSystemHealth(db) {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: "unknown",
  };

  if (db) {
    try {
      await db`SELECT 1`;
      health.database = "connected";
    } catch (e) {
      health.database = "disconnected";
      health.status = "degraded";
    }
  }

  return health;
}
