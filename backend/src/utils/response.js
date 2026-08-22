function ok(res, data = null, message = 'success', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function created(res, data = null, message = 'created') {
  return ok(res, data, message, 201);
}

function paginated(res, rows, total, page, limit, extra = {}) {
  return res.status(200).json({
    success: true,
    message: 'success',
    data: rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Math.ceil(total / limit) || 1,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
    ...extra,
  });
}

function fail(res, message = 'Something went wrong', status = 400, errors = null) {
  return res.status(status).json({ success: false, message, errors });
}

/** Async controller wrapper — avoids writing try/catch everywhere */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** A typed error for throwing */
function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

module.exports = { ok, created, paginated, fail, asyncHandler, httpError };
