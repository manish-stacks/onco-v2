const db = require('../config/db');
const { QueryBuilder } = require('../utils/queryBuilder');
const { pickDefined } = require('../utils/helpers');

const SAFE_FIELDS = `admin_id, admin_username, admin_name, admin_email, admin_phone, avatar,
  department, employee_code, user_type, last_login, last_ip, status, created_at`;

const WRITABLE = ['admin_username', 'admin_name', 'admin_email', 'admin_phone', 'avatar',
  'department', 'employee_code', 'user_type', 'status'];

// ---------------------------------------------------------------------------
// ADMINS (super admin / sub admin / employee — sab yahi table me, role se farak)
// ---------------------------------------------------------------------------
async function findByUsername(username) {
  const [[row]] = await db.query(
    `SELECT a.*, r.name AS role_name FROM admins a
     LEFT JOIN roles r ON r.type_id = a.user_type
     WHERE a.admin_username = ? LIMIT 1`,
    [username]
  );
  return row || null;
}

async function findByEmail(email) {
  const [[row]] = await db.query(`SELECT * FROM admins WHERE admin_email = ? LIMIT 1`, [email]);
  return row || null;
}

async function findById(adminId) {
  const [[row]] = await db.query(
    `SELECT a.admin_id, a.admin_username, a.admin_name, a.admin_email, a.admin_phone, a.avatar,
            a.department, a.employee_code, a.user_type, a.last_login, a.last_ip, a.status, a.created_at,
            r.name AS role_name
     FROM admins a
     LEFT JOIN roles r ON r.type_id = a.user_type
     WHERE a.admin_id = ?`,
    [adminId]
  );
  return row || null;
}

async function list(filters = {}, { limit = 20, offset = 0 } = {}) {
  const qb = new QueryBuilder('a');
  qb.eq('status', filters.status)
    .eq('user_type', filters.role_id)
    .eq('department', filters.department)
    .like(['admin_name', 'admin_username', 'admin_email', 'employee_code'], filters.search);

  const { sql: whereSql, params } = qb.build();

  const [rows] = await db.query(
    `SELECT a.admin_id, a.admin_username, a.admin_name, a.admin_email, a.admin_phone, a.avatar,
            a.department, a.employee_code, a.user_type, a.last_login, a.last_ip, a.status, a.created_at,
            r.name AS role_name
     FROM admins a LEFT JOIN roles r ON r.type_id = a.user_type
     ${whereSql} ORDER BY a.admin_id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM admins a ${whereSql}`, params);
  return { rows, total };
}

async function create(data) {
  const [result] = await db.query(
    `INSERT INTO admins SET ?`,
    [{
      admin_username: data.admin_username,
      admin_name: data.admin_name,
      admin_password: data.admin_password,
      admin_email: data.admin_email || null,
      admin_phone: data.admin_phone || null,
      department: data.department || null,
      employee_code: data.employee_code || null,
      user_type: data.user_type,
      created_by: data.created_by || null,
      status: data.status || 'Active',
    }]
  );
  return result.insertId;
}

async function update(adminId, data) {
  const payload = pickDefined(data, WRITABLE);
  if (!Object.keys(payload).length) return false;
  await db.query(`UPDATE admins SET ? WHERE admin_id = ?`, [payload, adminId]);
  return true;
}

async function updatePassword(adminId, hashedPassword) {
  await db.query(`UPDATE admins SET admin_password = ? WHERE admin_id = ?`, [hashedPassword, adminId]);
}

async function updateLastLogin(adminId, ip) {
  await db.query(`UPDATE admins SET last_login = NOW(), last_ip = ? WHERE admin_id = ?`, [ip, adminId]);
}

async function remove(adminId) {
  await db.query(`DELETE FROM admins WHERE admin_id = ?`, [adminId]);
}

async function setOtp(adminId, otp, minutes = 10) {
  await db.query(
    `UPDATE admins SET otp = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE admin_id = ?`,
    [otp, minutes, adminId]
  );
}

async function verifyOtp(adminId, otp) {
  const [[row]] = await db.query(
    `SELECT admin_id FROM admins WHERE admin_id = ? AND otp = ? AND otp_expiry >= NOW()`, [adminId, otp]
  );
  if (!row) return false;
  await db.query(`UPDATE admins SET otp = NULL, otp_expiry = NULL WHERE admin_id = ?`, [adminId]);
  return true;
}

// ---------------------------------------------------------------------------
// ROLES + PERMISSIONS
// ---------------------------------------------------------------------------
async function listRoles() {
  const [rows] = await db.query(
    `SELECT r.*, COUNT(DISTINCT a.admin_id) AS admin_count,
            COUNT(DISTINCT rp.id) AS permission_count
     FROM roles r
     LEFT JOIN admins a ON a.user_type = r.type_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.type_id
     GROUP BY r.type_id ORDER BY r.type_id ASC`
  );
  return rows;
}

async function findRoleById(roleId) {
  const [[role]] = await db.query(`SELECT * FROM roles WHERE type_id = ?`, [roleId]);
  if (!role) return null;
  const [perms] = await db.query(`SELECT permission FROM role_permissions WHERE role_id = ?`, [roleId]);
  return { ...role, permissions: perms.map((p) => p.permission) };
}

async function getPermissions(roleId) {
  const [rows] = await db.query(`SELECT permission FROM role_permissions WHERE role_id = ?`, [roleId]);
  return rows.map((r) => r.permission);
}

async function createRole({ name, description, permissions = [] }) {
  return db.withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO roles (name, description, is_system, status) VALUES (?,?,0,'Active')`,
      [name, description || null]
    );
    const roleId = result.insertId;
    if (permissions.length) {
      await conn.query(`INSERT INTO role_permissions (role_id, permission) VALUES ?`,
        [permissions.map((p) => [roleId, p])]);
    }
    return roleId;
  });
}

async function updateRole(roleId, { name, description, status, permissions }) {
  return db.withTransaction(async (conn) => {
    const payload = pickDefined({ name, description, status }, ['name', 'description', 'status']);
    if (Object.keys(payload).length) {
      await conn.query(`UPDATE roles SET ? WHERE type_id = ?`, [payload, roleId]);
    }
    if (Array.isArray(permissions)) {
      await conn.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
      if (permissions.length) {
        await conn.query(`INSERT INTO role_permissions (role_id, permission) VALUES ?`,
          [permissions.map((p) => [roleId, p])]);
      }
    }
  });
}

async function removeRole(roleId) {
  const [[{ count }]] = await db.query(`SELECT COUNT(*) AS count FROM admins WHERE user_type = ?`, [roleId]);
  if (count > 0) {
    throw Object.assign(new Error(`Is role pe ${count} admin(s) hain — pehle unko dusre role me shift karo`), { status: 409 });
  }
  const [[role]] = await db.query(`SELECT is_system FROM roles WHERE type_id = ?`, [roleId]);
  if (role?.is_system) throw Object.assign(new Error('System role delete nahi ho sakta'), { status: 403 });

  await db.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
  await db.query(`DELETE FROM roles WHERE type_id = ?`, [roleId]);
}

// ---------------------------------------------------------------------------
// ACTIVITY LOG
// ---------------------------------------------------------------------------
async function logActivity({ admin_id, admin_username, action, module, record_id, description, ip_address }) {
  try {
    await db.query(
      `INSERT INTO admin_activity_logs
        (admin_id, admin_username, action, module, record_id, description, ip_address)
       VALUES (?,?,?,?,?,?,?)`,
      [admin_id || null, admin_username || null, action, module || null,
        record_id ? String(record_id) : null, description || null, ip_address || null]
    );
  } catch (err) {
    console.error('[activity-log] fail:', err.message); // logging kabhi request fail na kare
  }
}

async function listActivity(filters = {}, { limit = 50, offset = 0 } = {}) {
  const qb = new QueryBuilder('l');
  qb.eq('admin_id', filters.admin_id)
    .eq('module', filters.module)
    .eq('action', filters.action)
    .gte('created_at', filters.from_date)
    .lte('created_at', filters.to_date);

  const { sql: whereSql, params } = qb.build();
  const [rows] = await db.query(
    `SELECT l.* FROM admin_activity_logs l ${whereSql} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM admin_activity_logs l ${whereSql}`, params);
  return { rows, total };
}

module.exports = {
  findByUsername, findByEmail, findById, list, create, update, updatePassword,
  updateLastLogin, remove, setOtp, verifyOtp,
  listRoles, findRoleById, getPermissions, createRole, updateRole, removeRole,
  logActivity, listActivity,
};
