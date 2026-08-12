/* eslint-disable no-unused-vars */
const multer = require('multer');

function notFound(req, res, next) {
  res.status(404).json({ success: false, message: `Route nahi mila: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  // multer ke apne errors
  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: 'File bahut badi hai',
      LIMIT_FILE_COUNT: 'Bahut saari files',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    return res.status(400).json({ success: false, message: map[err.code] || err.message });
  }

  // mysql ke common errors -> readable message
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Ye record pehle se maujood hai (duplicate entry)' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ success: false, message: 'Ye record kisi aur record se juda hua hai, pehle wo hatao' });
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
