
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, _next) {
  console.error('[error]', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}


class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.statusCode = status;
  }
}

module.exports = { asyncHandler, notFound, errorHandler, ApiError };
