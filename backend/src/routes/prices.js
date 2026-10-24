import { Router } from 'express';
import { jwtAuth } from '../middleware/auth.js';
import { catalogFor } from '../services/catalog.js';

export const pricesRouter = Router();

/**
 * GET /api/prices — the app's only price source.
 * Role decides the shape (see services/catalog.js): customers/unapproved dealers
 * get mrp-only; active dealers on an approved account also get dealer_rate.
 */
pricesRouter.get('/', jwtAuth, async (req, res, next) => {
  try {
    const products = await catalogFor(req.user);
    const hasDealerPricing =
      req.user.role === 'dealer' ||
      (req.user.role === 'dealer_staff' && req.user.can_see_dealer_price !== false && !req.user.hide_staff_dealer_price);
    res.json({
      role: req.user.role,
      price_tier: hasDealerPricing ? 'dealer' : 'retail',
      count: products.length,
      products,
    });
  } catch (err) { next(err); }
});
