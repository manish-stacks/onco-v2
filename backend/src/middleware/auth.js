const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

// Requires a valid user access token. Attaches req.userId.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, "Missing access token"));

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.type !== "user") return next(new ApiError(401, "Invalid token type"));
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

// Optional auth: attaches req.userId if a valid token is present, otherwise continues
// (used for guest-accessible routes that behave differently when logged in, e.g. product view)
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload.type === "user") req.userId = payload.sub;
  } catch (err) {
    // ignore invalid token in optional mode
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
