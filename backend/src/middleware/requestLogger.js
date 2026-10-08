import crypto from "crypto";

export function requestLogger(req, res, next) {
  req.id = req.headers["x-correlation-id"] || `req_${crypto.randomBytes(6).toString("hex")}`;
  res.setHeader("X-Correlation-Id", req.id);
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.warn(`[${req.method}] ${req.originalUrl} ${res.statusCode} - ${duration}ms (${req.id})`);
    }
  });

  next();
}
