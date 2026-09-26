// Success envelope. `message` is kept at the top level for clients written
// against the pre-Phase-0 API, which read body.message.
export const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, ...data });
export const created = (res, data = {}) => ok(res, data, 201);

export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { limit, page, skip: (page - 1) * limit };
};

export const paginated = (items, total, { page, limit }) => ({
  items,
  pagination: { page, limit, total, pages: Math.ceil(total / limit) },
});
