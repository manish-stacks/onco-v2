const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { fail } = require('../utils/response');
const cache = require('../utils/cache');

/** JWT verify + admin active check */
async function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return fail(res, 'Authorization token missing', 401);

  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_ADMIN_SECRET);

    // The JWT's user_type/status were correct AT LOGIN TIME. If the admin is
    // deactivated or moved to a different role afterwards, the old token
    // must stop working (or start using the new role) well before it
    // naturally expires — so re-check the live row, short-cached since this
    // runs on every request.
    const live = await cache.getOrSet(`rbac:admin:${decoded.admin_id}`, cache.TTL.SHORT, async () => {
      const [[row]] = await db.query(
        `SELECT status, user_type FROM admins WHERE admin_id = ?`, [decoded.admin_id]
      );
      return row || null;
    });

    if (!live || live.status !== 'Active') {
      return fail(res, 'Your account has been deactivated. Contact a Super Admin.', 401);
    }

    req.admin = { ...decoded, user_type: live.user_type }; // { admin_id, admin_username, user_type, role_name }
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

/** Clear one admin's cached status/role — call this when that admin is updated (status, role, etc) */
async function clearAdminCache(adminId) {
  if (adminId) await cache.del(`rbac:admin:${adminId}`);
}

module.exports = { adminAuth, requirePermission, getRolePermissions, clearRoleCache, clearAdminCache };
