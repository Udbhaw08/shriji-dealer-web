export function calculateDiscountPercentage(original, discounted) {
  if (!original || !discounted || original <= discounted) return 0;
  return Math.round(((original - discounted) / original) * 100);
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
