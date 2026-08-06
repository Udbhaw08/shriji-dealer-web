export function truncate(str, maxLength = 50) {
  if (!str || str.length <= maxLength) return str || "";
  return str.slice(0, maxLength).trim() + "...";
}

export function titleCase(str) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}
