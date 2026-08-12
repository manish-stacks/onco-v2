const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');
const { PLATFORMS } = require('../config/constants');

/**
 * Extract JWT token from all supported locations
 */
function extractToken(req) {
  // 1. Authorization: Bearer <token>
  const authorization = req.headers.authorization || '';

  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }

  // 2. x-access-token
  if (req.headers['x-access-token']) {
    return String(req.headers['x-access-token']).trim();
  }

  // 3. x-auth-token
  if (req.headers['x-auth-token']) {
    return String(req.headers['x-auth-token']).trim();
  }

  // 4. token header
  if (req.headers.token) {
    return String(req.headers.token).trim();
  }

  // 5. Query token
  if (req.query?.token) {
    return String(req.query.token).trim();
  }

  // 6. Body token
  if (req.body?.token) {
    return String(req.body.token).trim();
  }

  // 7. Cookie token
  if (req.cookies?.ohm_token) {
    return String(req.cookies.ohm_token).trim();
  }

  return null;
}

/**
 * Resolve platform
 */
function resolvePlatform(req, decoded) {
  const p = String(
    req.headers['x-client-platform'] ||
      decoded?.platform ||
      'web'
  ).toLowerCase();

  return PLATFORMS.includes(p) ? p : 'web';
}

/**
 * Required authentication
 * Token nahi hai / invalid hai => 401
 */
function customerAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return fail(res, 'Authorization token missing', 401);
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.customer = decoded;
    req.token = token;
    req.platform = resolvePlatform(req, decoded);

    return next();
  } catch (err) {
    const msg =
      err.name === 'TokenExpiredError'
        ? 'Session expired, please login again'
        : 'Invalid token';

    return fail(res, msg, 401);
  }
}

/**
 * Optional authentication
 * Guest browsing allowed.
 * Valid token mila to req.customer set hoga.
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  console.log("optionalAuth token", token);
  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      req.customer = decoded;
      req.token = token;
    } catch (err) {
      // Invalid/expired token ko guest treat karo
      req.customer = null;
      req.token = null;
    }
  }

  req.platform = resolvePlatform(req, req.customer);

  return next();
}

module.exports = {
  customerAuth,
  optionalAuth,
  extractToken,
  resolvePlatform,
};