const jwt = require('jsonwebtoken');
const eventsService = require('../../services/events.service');
const { getRolePermissions } = require('../../middleware/adminAuth');
const { ok, fail, asyncHandler } = require('../../utils/response');

/**
 * GET /api/admin/events?token=<jwt>
 *
 * EventSource browser API custom headers nahi bhej sakti, isliye token
 * query param me aata hai. Same-origin (nginx proxy) pe ye theek hai —
 * lekin access logs me token na aaye iske liye nginx me is path ka
 * logging band kar dena behtar hai:
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
    return res.status(401).json({ success: false, message: 'Invalid ya expired token' });
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

/** GET /api/admin/events/status — kitne admins connected hain */
const status = asyncHandler(async (req, res) => ok(res, {
  connected_clients: eventsService.clientCount(),
}));

module.exports = { stream, status };
