export function paginate(items, page = 1, pageSize = 20) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = (p - 1) * size;
  return {
    data: items.slice(offset, offset + size),
    page: p,
    pageSize: size,
    total: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}
