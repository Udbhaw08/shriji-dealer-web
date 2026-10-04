import { log } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  if (status >= 500) log.error(`[http] ${req.method} ${req.path} →`, err.message);
  res.status(status).json({ error: err.publicMessage || err.message || 'internal_error' });
}

export const httpError = (statusCode, publicMessage) =>
  Object.assign(new Error(publicMessage), { statusCode, publicMessage });
