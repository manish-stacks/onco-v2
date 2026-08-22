const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { fail } = require('../utils/response');
const cache = require('../utils/cache');

/** JWT verify + admin active check */
function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return fail(res, 'Authorization token missing', 401);

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_ADMIN_SECRET);
    req.admin = decoded; // { admin_id, admin_username, user_type, role_name }
    return next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired, login again' : 'Invalid admin token';
    return fail(res, msg, 401);
  }
}

/** Permissions for a role — cached for 5 min, since it is checked on every request */
async function getRolePermissions(roleId) {
  return cache.getOrSet(`rbac:role:${roleId}`, cache.TTL.MEDIUM, async () => {
    const [rows] = await db.query(`SELECT permission FROM role_permissions WHERE role_id = ?`, [roleId]);
    return rows.map((r) => r.permission);
  });
}

/**
 * requirePermission('orders.manage')
 * You can pass several — allow if any one of them matches:
 * requirePermission(['orders.manage','orders.cancel'])
 */
function requirePermission(permission) {
  const required = Array.isArray(permission) ? permission : [permission];

  return async (req, res, next) => {
    try {
      if (!req.admin) return fail(res, 'Not authenticated', 401);

      const perms = await getRolePermissions(req.admin.user_type);
      const allowed = required.some((p) => perms.includes(p));
      if (!allowed) {
        return fail(res, `Permission denied — required: ${required.join(' or ')}`, 403);
      }
      req.adminPermissions = perms;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/** Clear the role permissions cache — call this when a role is updated */
async function clearRoleCache(roleId) {
  if (roleId) await cache.del(`rbac:role:${roleId}`);
  else await cache.delByPrefix('rbac:role:');
}

module.exports = { adminAuth, requirePermission, getRolePermissions, clearRoleCache };
