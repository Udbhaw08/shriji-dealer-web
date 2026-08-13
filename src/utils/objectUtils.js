export function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  const res = {};
  for (const k of keys) {
    if (k in obj) res[k] = obj[k];
  }
  return res;
}

export function omit(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  const res = { ...obj };
  for (const k of keys) {
    delete res[k];
  }
  return res;
}
