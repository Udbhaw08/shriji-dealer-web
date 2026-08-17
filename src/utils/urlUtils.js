export function buildUrlWithQuery(baseUrl, params = {}) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") search.set(k, String(v));
  }
  const q = search.toString();
  return q ? `${baseUrl}?${q}` : baseUrl;
}
