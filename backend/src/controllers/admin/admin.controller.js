const bcrypt = require('bcryptjs');
const adminModel = require('../../models/admin.model');
const { clearRoleCache } = require('../../middleware/adminAuth');
const { ALL_PERMISSIONS } = require('../../config/constants');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

/**
 * Sub-admin aur employee dono yahi se bante hain — bas role alag hota hai.
 * Role decide karta hai kaun kya kar sakta hai.
 */

// ---------------------------------------------------------------------------
// ADMIN USERS
// ---------------------------------------------------------------------------
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await adminModel.list({
    status: req.query.status,
    role_id: req.query.role_id,
    department: req.query.department,
    search: req.query.search,
  }, { limit, offset });
  return paginated(res, rows, total, page, limit);
});

const detail = asyncHandler(async (req, res) => {
  const admin = await adminModel.findById(req.params.adminId);
  if (!admin) return fail(res, 'Admin nahi mila', 404);

  const permissions = await adminModel.getPermissions(admin.user_type);
  return ok(res, { ...admin, permissions });
});

/** POST /admin/admins — naya sub-admin / employee banao */
const create = asyncHandler(async (req, res) => {
  const { admin_username, admin_name, password, admin_email, admin_phone,
    department, employee_code, user_type, status } = req.body;

  if (!admin_username || !password || !user_type) {
    return fail(res, 'admin_username, password aur user_type zaroori hain', 422);
  }
  if (password.length < 8) return fail(res, 'Password kam se kam 8 characters ka ho', 422);

  if (await adminModel.findByUsername(admin_username)) {
    return fail(res, 'Ye username pehle se hai', 409);
  }

  const role = await adminModel.findRoleById(user_type);
  if (!role) return fail(res, 'Ye role exist nahi karta', 422);

  const adminId = await adminModel.create({
    admin_username,
    admin_name: admin_name || admin_username,
    admin_password: await bcrypt.hash(password, 10),
    admin_email, admin_phone, department, employee_code,
    user_type,
    status: status || 'Active',
    created_by: req.admin.admin_id,
  });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'create', module: 'admins', record_id: adminId,
    description: `${admin_username} (${role.name})`, ip_address: req.ip,
  });

  return created(res, await adminModel.findById(adminId), 'Admin user ban gaya');
});

/** PATCH /admin/admins/:adminId */
const update = asyncHandler(async (req, res) => {
  const target = await adminModel.findById(req.params.adminId);
  if (!target) return fail(res, 'Admin nahi mila', 404);

  // khud ka role khud change nahi kar sakte (lockout se bachne ke liye)
  if (Number(req.params.adminId) === req.admin.admin_id && req.body.user_type
      && Number(req.body.user_type) !== target.user_type) {
    return fail(res, 'Apna khud ka role change nahi kar sakte', 403);
  }

  await adminModel.update(req.params.adminId, req.body);
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'update', module: 'admins', record_id: req.params.adminId, ip_address: req.ip,
  });

  return ok(res, await adminModel.findById(req.params.adminId), 'Admin update ho gaya');
});

/** POST /admin/admins/:adminId/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return fail(res, 'Naya password kam se kam 8 characters ka ho', 422);
  }

  const target = await adminModel.findById(req.params.adminId);
  if (!target) return fail(res, 'Admin nahi mila', 404);

  await adminModel.updatePassword(req.params.adminId, await bcrypt.hash(new_password, 10));
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'reset_password', module: 'admins', record_id: req.params.adminId,
    description: target.admin_username, ip_address: req.ip,
  });

  return ok(res, null, 'Password reset ho gaya');
});

/** PATCH /admin/admins/:adminId/status */
const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Active', 'Inactive'].includes(status)) return fail(res, "status 'Active' ya 'Inactive' ho", 422);

  if (Number(req.params.adminId) === req.admin.admin_id) {
    return fail(res, 'Apne aap ko deactivate nahi kar sakte', 403);
  }

  await adminModel.update(req.params.adminId, { status });
  return ok(res, null, `Admin ${status} kar diya`);
});

const remove = asyncHandler(async (req, res) => {
  if (Number(req.params.adminId) === req.admin.admin_id) {
    return fail(res, 'Apna khud ka account delete nahi kar sakte', 403);
  }

  const target = await adminModel.findById(req.params.adminId);
  if (!target) return fail(res, 'Admin nahi mila', 404);

  await adminModel.remove(req.params.adminId);
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'delete', module: 'admins', record_id: req.params.adminId,
    description: target.admin_username, ip_address: req.ip,
  });

  return ok(res, null, 'Admin delete ho gaya');
});

// ---------------------------------------------------------------------------
// ROLES
// ---------------------------------------------------------------------------
const listRoles = asyncHandler(async (req, res) => ok(res, await adminModel.listRoles()));

/** GET /admin/roles/permissions — poora catalog, role editor ke liye */
const permissionCatalog = asyncHandler(async (req, res) => {
  // module ke hisaab se group karke bhejo, frontend me checkbox groups banenge
  const grouped = {};
  ALL_PERMISSIONS.forEach((p) => {
    const [module] = p.split('.');
    if (!grouped[module]) grouped[module] = [];
    grouped[module].push(p);
  });
  return ok(res, { all: ALL_PERMISSIONS, grouped });
});

const roleDetail = asyncHandler(async (req, res) => {
  const role = await adminModel.findRoleById(req.params.roleId);
  if (!role) return fail(res, 'Role nahi mila', 404);
  return ok(res, role);
});

const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name) return fail(res, 'name zaroori hai', 422);

  const invalid = (permissions || []).filter((p) => !ALL_PERMISSIONS.includes(p));
  if (invalid.length) return fail(res, `Ye permissions valid nahi hain: ${invalid.join(', ')}`, 422);

  const roleId = await adminModel.createRole({ name, description, permissions });
  await clearRoleCache();
  return created(res, await adminModel.findRoleById(roleId), 'Role ban gaya');
});

const updateRole = asyncHandler(async (req, res) => {
  const role = await adminModel.findRoleById(req.params.roleId);
  if (!role) return fail(res, 'Role nahi mila', 404);

  if (req.body.permissions) {
    const invalid = req.body.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length) return fail(res, `Ye permissions valid nahi hain: ${invalid.join(', ')}`, 422);
  }

  await adminModel.updateRole(req.params.roleId, req.body);
  await clearRoleCache(req.params.roleId);

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'update', module: 'roles', record_id: req.params.roleId,
    description: role.name, ip_address: req.ip,
  });

  return ok(res, await adminModel.findRoleById(req.params.roleId), 'Role update ho gaya');
});

const removeRole = asyncHandler(async (req, res) => {
  await adminModel.removeRole(req.params.roleId);
  await clearRoleCache(req.params.roleId);
  return ok(res, null, 'Role delete ho gaya');
});

// ---------------------------------------------------------------------------
// ACTIVITY LOG
// ---------------------------------------------------------------------------
const activityLog = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 50, 200);
  const { rows, total } = await adminModel.listActivity({
    admin_id: req.query.admin_id,
    module: req.query.module,
    action: req.query.action,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
  }, { limit, offset });
  return paginated(res, rows, total, page, limit);
});

module.exports = {
  list, detail, create, update, resetPassword, setStatus, remove,
  listRoles, permissionCatalog, roleDetail, createRole, updateRole, removeRole,
  activityLog,
};
