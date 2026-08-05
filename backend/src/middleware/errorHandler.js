const { ZodError } = require("zod");
const ApiError = require("../utils/ApiError");

// Keep this LAST in app.use() chain — Express routes 4-arg middleware to error handlers.
function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, message: "Validation error", errors: err.errors });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message, details: err.details });
  }

  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "A record with this value already exists" });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found" });
  }

  console.error(err);
  res.status(500).json({ success: false, message: "Internal server error" });
}

module.exports = errorHandler;
