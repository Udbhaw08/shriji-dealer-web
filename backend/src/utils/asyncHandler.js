/**
 * Wraps express route handlers to catch unhandled promise rejections.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
