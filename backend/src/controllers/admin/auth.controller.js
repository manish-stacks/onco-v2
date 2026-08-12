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
  if (!admin) return fail(res, 'Username ya password galat hai', 401);
  if (admin.status !== 'Active') return fail(res, 'Aapka account inactive hai', 403);

  const match = await bcrypt.compare(password, admin.admin_password || '');
  if (!match) return fail(res, 'Username ya password galat hai', 401);

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
  }, 'Login ho gaya');
});

/** GET /admin/auth/me — permissions ke saath (frontend menu isse render hota hai) */
const me = asyncHandler(async (req, res) => {
  const admin = await adminModel.findById(req.admin.admin_id);
  if (!admin) return fail(res, 'Admin nahi mila', 404);
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
  return ok(res, await adminModel.findById(req.admin.admin_id), 'Profile update ho gaya');
});

/** POST /admin/auth/change-password */
const changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;

  const admin = await adminModel.findByUsername(req.admin.admin_username);
  const match = await bcrypt.compare(old_password, admin.admin_password || '');
  if (!match) return fail(res, 'Purana password galat hai', 401);

  await adminModel.updatePassword(req.admin.admin_id, await bcrypt.hash(new_password, 10));
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'change_password', module: 'auth', ip_address: req.ip,
  });

  return ok(res, null, 'Password badal gaya');
});

/** POST /admin/auth/logout — activity log ke liye */
const logout = asyncHandler(async (req, res) => {
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'logout', module: 'auth', ip_address: req.ip,
  });
  return ok(res, null, 'Logout ho gaya');
});

module.exports = { login, me, updateProfile, changePassword, logout };
