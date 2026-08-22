const jwt = require('jsonwebtoken');
const eventsService = require('../../services/events.service');
const { getRolePermissions } = require('../../middleware/adminAuth');
const { ok, fail, asyncHandler } = require('../../utils/response');

/**
 * GET /api/admin/events?token=<jwt>
 *
 * The EventSource browser API cannot send custom headers, so the token
 * arrives in a query param. On same-origin (nginx proxy) this is fine —
 * but to keep the token out of the access logs, disable logging for this path in nginx
 * it is better to turn logging off:
 *
 *   location /api/admin/events { access_log off; proxy_buffering off; ... }
 */
async function stream(req, res) {
  const token = req.query.token;
  if (!token) return res.status(401).json({ success: false, message: 'Token missing' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  const permissions = await getRolePermissions(decoded.user_type);

  const cleanup = eventsService.addClient(res, {
    adminId: decoded.admin_id,
    permissions,
  });

  req.on('close', cleanup);
  req.on('error', cleanup);
  return undefined;
}

/** GET /api/admin/events/status — how many admins are connected */
const status = asyncHandler(async (req, res) => ok(res, {
  connected_clients: eventsService.clientCount(),
}));

module.exports = { stream, status };
