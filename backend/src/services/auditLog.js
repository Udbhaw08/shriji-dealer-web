export function recordAuditLog(event, metadata = {}) {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    metadata,
  };
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}
