const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminModel = require('../../models/admin.model');
const smsService = require('../../services/sms.service');
const { getRolePermissions } = require('../../middleware/adminAuth');
const { ok, fail, asyncHandler } = require('../../utils/response');
const { storeFile } = require('../../middleware/upload');
const { genOtp } = require('../../utils/helpers');

/** Admin login OTP is ON by default; set ADMIN_OTP_ENABLED=false to force password-only. */
function adminOtpEnabled() {
  return String(process.env.ADMIN_OTP_ENABLED ?? 'true').toLowerCase() !== 'false';
}

/** Build the signed JWT + response body for a fully authenticated admin. */
async function issueSession(admin) {
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

  const permissions = await getRolePermissions(admin.user_type);

  return {
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
  };
}

/** Generate, save and SMS an OTP to the admin's registered phone. */
async function dispatchAdminOtp(admin, req) {
  const otp = genOtp(6);
  await adminModel.setOtp(admin.admin_id, otp, 10);
  await smsService.sendOtp(admin.admin_phone, otp, {
    customerId: null,
    purpose: 'admin_login',
    source: 'web',
    ip: req.ip,
    expiresAt: new Date(Date.now() + 10 * 60000).toISOString().slice(0, 19).replace('T', ' '),
  });
  return otp;
}

function maskMobile(m) {
  const d = String(m || '').replace(/\D/g, '').slice(-10);
  return d ? `••••••${d.slice(-4)}` : '';
}

/** POST /admin/auth/login — super admin, sub admin, employee sab yahi se */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  const admin = await adminModel.findByUsername(username);
  if (!admin) return fail(res, 'Username or password is incorrect', 401);
  if (admin.status !== 'Active') return fail(res, 'Your account is inactive', 403);

  const match = await bcrypt.compare(password, admin.admin_password || '');
  if (!match) return fail(res, 'Username or password is incorrect', 401);

  // ---- Step 2: OTP to the admin's registered mobile (like the old site) ----
  // Only when it's enabled AND the account actually has a phone number — otherwise
  // nobody can be locked out and we fall back to a direct login.
  if (adminOtpEnabled() && admin.admin_phone) {
    let devOtp = null;
    try {
      devOtp = await dispatchAdminOtp(admin, req);
    } catch (err) {
      return fail(res, err.message || 'Could not send the OTP, please try again', err.status || 502);
    }

    return ok(res, {
      otp_required: true,
      admin_id: admin.admin_id,
      mobile_hint: maskMobile(admin.admin_phone),
      ...(smsService.isConfigured() ? {} : { dev_otp: devOtp }),
    }, 'OTP sent to your registered mobile number');
  }

  // OTP disabled / no phone on file → straight in.
  await adminModel.updateLastLogin(admin.admin_id, req.ip);
  await adminModel.logActivity({
    admin_id: admin.admin_id, admin_username: admin.admin_username,
    action: 'login', module: 'auth', ip_address: req.ip,
  });

  return ok(res, await issueSession(admin), 'Logged in');
});

/** POST /admin/auth/verify-otp — second step of login */
const verifyOtp = asyncHandler(async (req, res) => {
  const adminId = req.body.admin_id;
  const otp = String(req.body.otp || '').trim();
  if (!adminId || !otp) return fail(res, 'admin_id and otp are required', 422);

  const valid = await adminModel.verifyOtp(adminId, otp);
  if (!valid) return fail(res, 'The OTP is invalid or has expired', 401);

  const admin = await adminModel.findById(adminId);
  if (!admin) return fail(res, 'Admin not found', 404);
  if (admin.status !== 'Active') return fail(res, 'Your account is inactive', 403);

  await adminModel.updateLastLogin(admin.admin_id, req.ip);
  await adminModel.logActivity({
    admin_id: admin.admin_id, admin_username: admin.admin_username,
    action: 'login', module: 'auth', ip_address: req.ip,
  });

  return ok(res, await issueSession(admin), 'Logged in');
});

/** POST /admin/auth/resend-otp — resend the login OTP */
const resendOtp = asyncHandler(async (req, res) => {
  const adminId = req.body.admin_id;
  if (!adminId) return fail(res, 'admin_id is required', 422);

  const admin = await adminModel.findById(adminId);
  if (!admin || !admin.admin_phone) return fail(res, 'No mobile number on file for this account', 409);

  let devOtp = null;
  try {
    devOtp = await dispatchAdminOtp(admin, req);
  } catch (err) {
    return fail(res, err.message || 'Could not send the OTP', err.status || 502);
  }

  return ok(res, {
    admin_id: admin.admin_id,
    mobile_hint: maskMobile(admin.admin_phone),
    ...(smsService.isConfigured() ? {} : { dev_otp: devOtp }),
  }, 'A new OTP has been sent');
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

module.exports = { login, verifyOtp, resendOtp, me, updateProfile, changePassword, logout };
