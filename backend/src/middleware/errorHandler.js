/* eslint-disable no-unused-vars */
const multer = require('multer');

function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  // multer's own errors
  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: 'The file is too large',
      LIMIT_FILE_COUNT: 'Bahut saari files',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    return res.status(400).json({ success: false, message: map[err.code] || err.message });
  }

  // mysql ke common errors -> readable message
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'This record already exists (duplicate entry)' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ success: false, message: 'This record is linked to another record, remove that one first' });
  }

  // A raw failure from an outbound/vendor HTTP call (DTDC, PayU, Fast2SMS, 2Factor,
  // BuzWap, …). Since axios 1.5 the VENDOR's HTTP status is copied onto err.status,
  // so a DTDC 401/403 would otherwise be sent back as OUR 401 — and the admin panel
  // treats every 401 as "session expired" and logs the user out. A failed upstream
  // call is a gateway error on our side, never an auth problem with the admin's
  // session, so always normalise it to 502.
  if (err.isAxiosError) {
    console.error('[error] upstream call failed:',
      err.response?.status, err.config?.url || '', err.message);
    const vendorMsg = err.response?.data?.message
      || err.response?.data?.error
      || err.message;
    return res.status(502).json({
      success: false,
      message: `Upstream service error: ${String(vendorMsg || 'no response').slice(0, 200)}`,
    });
  }

  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

module.exports = { notFound, errorHandler };