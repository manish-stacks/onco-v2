/**
 * Seeds roles + permissions + one super admin.
 *   npm run seed
 * Idempotent — you can run it repeatedly, no duplicates are created.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { DEFAULT_ROLES } = require('../config/constants');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('[seed] connected');

  const roleIds = {};

  for (const role of DEFAULT_ROLES) {
    const [[existing]] = await conn.query(`SELECT type_id FROM roles WHERE name = ?`, [role.name]);

    let roleId;
    if (existing) {
      roleId = existing.type_id;
      await conn.query(`UPDATE roles SET description = ?, is_system = ? WHERE type_id = ?`, [
        role.description, role.is_system, roleId,
      ]);
      console.log(`[seed] role exists: ${role.name} (#${roleId})`);
    } else {
      const [result] = await conn.query(
        `INSERT INTO roles (name, description, is_system, status) VALUES (?,?,?, 'Active')`,
        [role.name, role.description, role.is_system]
      );
      roleId = result.insertId;
      console.log(`[seed] role created: ${role.name} (#${roleId})`);
    }
    roleIds[role.name] = roleId;

    // permissions sync — purani hata ke nayi daal do
    await conn.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
    if (role.permissions.length) {
      const values = role.permissions.map((p) => [roleId, p]);
      await conn.query(`INSERT INTO role_permissions (role_id, permission) VALUES ?`, [values]);
    }
    console.log(`         -> ${role.permissions.length} permissions`);
  }

  // ---- super admin ----
  const username = process.env.SEED_ADMIN_USERNAME || 'superadmin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@oncohealthmart.com';

  const [[existingAdmin]] = await conn.query(`SELECT admin_id FROM admins WHERE admin_username = ?`, [username]);
  if (existingAdmin) {
    console.log(`[seed] admin already exists: ${username}`);
  } else {
    const hashed = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO admins (admin_username, admin_name, admin_password, admin_email, user_type, status)
       VALUES (?,?,?,?,?, 'Active')`,
      [username, 'Super Admin', hashed, email, roleIds['Super Admin']]
    );
    console.log(`[seed] super admin created — username: ${username} / password: ${password}`);
    console.log('       ⚠  Log in and change the password immediately.');
  }

  console.log('[seed] done.');
  await conn.end();
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
