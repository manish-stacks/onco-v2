const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminModel = require('../../models/admin.model');
const { getRolePermissions } = require('../../middleware/adminAuth');
const { ok, fail, asyncHandler } = require('../../utils/response');
const { storeFile } = require('../../middleware/upload');

/** POST /admin/auth/login — super admin, sub admin, employee sab yahi se */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const admin = await adminModel.findByUsername(username);
  if (!admin) return fail(res, 'Username or password is incorrect', 401);
  if (admin.status !== 'Active') return fail(res, 'Your account is inactive', 403);

  const match = await bcrypt.compare(password, admin.admin_password || '');
  if (!match) return fail(res, 'Username or password is incorrect', 401);

  const token = jwt.sign(
    {
      admin_id: admin.admin_id,
      admin_username: admin.admin_username,
      user_type: admin.user_type,
      role_name: admin.role_name,
    },
    process.env.JWT_ADMIN_SECRET,
    { expiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '12h' }
  );

  await adminModel.updateLastLogin(admin.admin_id, req.ip);
  await adminModel.logActivity({
    admin_id: admin.admin_id, admin_username: admin.admin_username,
    action: 'login', module: 'auth', ip_address: req.ip,
  });

  const permissions = await getRolePermissions(admin.user_type);

  return ok(res, {
    token,
    admin: {
      admin_id: admin.admin_id,
      admin_username: admin.admin_username,
      admin_name: admin.admin_name,
      admin_email: admin.admin_email,
      avatar: admin.avatar,
      department: admin.department,
      user_type: admin.user_type,
      role_name: admin.role_name,
    },
    permissions,
  }, 'Logged in');
});

/** GET /admin/auth/me — with permissions (the frontend menu is rendered from this) */
const me = asyncHandler(async (req, res) => {
  const admin = await adminModel.findById(req.admin.admin_id);
  if (!admin) return fail(res, 'Admin not found', 404);
  const permissions = await getRolePermissions(admin.user_type);
  return ok(res, { ...admin, permissions });
});

/** PATCH /admin/auth/me */
const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['admin_name', 'admin_email', 'admin_phone', 'avatar'];
  const payload = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) payload[k] = req.body[k]; });
  if (req.file) payload.avatar = await storeFile(req.file, 'avatars');

  await adminModel.update(req.admin.admin_id, payload);
  return ok(res, await adminModel.findById(req.admin.admin_id), 'Profile updated');
});

/** POST /admin/auth/change-password */
const changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;

  const admin = await adminModel.findByUsername(req.admin.admin_username);
  const match = await bcrypt.compare(old_password, admin.admin_password || '');
  if (!match) return fail(res, 'Old password is incorrect', 401);

  await adminModel.updatePassword(req.admin.admin_id, await bcrypt.hash(new_password, 10));
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'change_password', module: 'auth', ip_address: req.ip,
  });

  return ok(res, null, 'Password changed');
});

/** POST /admin/auth/logout — activity log ke liye */
const logout = asyncHandler(async (req, res) => {
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'logout', module: 'auth', ip_address: req.ip,
  });
  return ok(res, null, 'Logged out');
});

module.exports = { login, me, updateProfile, changePassword, logout };
