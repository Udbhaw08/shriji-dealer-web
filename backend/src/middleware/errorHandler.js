import crypto from 'node:crypto';
import { log } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  const correlationId = req.headers['x-correlation-id'] || req.correlationId || crypto.randomUUID();

  if (status >= 500) {
    log.error(`[http] [${correlationId}] ${req.method} ${req.path} →`, err.stack || err.message);
    const message = process.env.NODE_ENV === 'production'
      ? (err.publicMessage || 'internal_server_error')
      : (err.publicMessage || err.message || 'internal_server_error');
    return res.status(status).json({ error: message, correlationId });
  }

  res.status(status).json({ error: err.publicMessage || err.message || 'error' });
}

export const httpError = (statusCode, publicMessage) =>
  Object.assign(new Error(publicMessage), { statusCode, publicMessage });
