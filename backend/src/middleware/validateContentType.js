export function validateContentType(req, res, next) {
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentType = req.headers["content-type"] || "";
    if (req.body && Object.keys(req.body).length > 0 && !contentType.includes("application/json")) {
      return res.status(415).json({
        ok: false,
        error: "Content-Type must be application/json",
      });
    }
  }
  next();
}
