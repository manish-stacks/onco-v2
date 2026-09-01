/**
 * Setup doctor — the answer to "nothing new is showing up in admin".
 *
 *   npm run doctor
 *   npm run doctor -- --fix     (automatically inserts missing permissions)
 *
 * Checks:
 *   1. Whether the migration tables exist
 *   2. Whether permissions are seeded in the DB
 *   3. Which permissions each admin role has
 *   4. What is and is not set in .env
 *   5. Whether a stale RBAC cache is left in Redis
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { ALL_PERMISSIONS, DEFAULT_ROLES } = require('../config/constants');

const OK = '  [ok]  ';
const BAD = '  [!!]  ';
const WARN = '  [--]  ';

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  });
  return args;
}

/** Which migration these tables come from */
const EXPECTED_TABLES = {
  '001 (schema refactor)': ['orders', 'order_items', 'prescriptions', 'inventory_logs',
    'order_status_logs', 'coupon_usages', 'wishlists', 'product_reviews', 'admin_activity_logs'],
  '002 (integrations)': ['otp_logs', 'device_tokens', 'notification_logs', 'shipments', 'shipment_scans'],
  '003 (media storage)': ['media_migration_items'],
};

/** Which permissions this feature requires */
const FEATURE_PERMS = {
  'System page (health, cache clear, media migration)': ['system.view', 'system.manage'],
  'Notifications page (message logs)': ['notifications.view'],
  'OTP logs tab': ['otp.view'],
  'Shipping panel (DTDC) on order detail': ['shipping.view', 'shipping.manage'],
};

async function main() {
  const args = parseArgs();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const dbName = process.env.DB_NAME;
  const problems = [];

  console.log(`\n=========== SETUP DOCTOR — ${dbName} ===========\n`);

  // -------------------------------------------------------------------------
  // 1. Tables
  // -------------------------------------------------------------------------
  console.log('1. MIGRATION TABLES\n');

  const [tableRows] = await conn.query(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?`, [dbName]
  );
  const existing = new Set(tableRows.map((r) => r.t || r.TABLE_NAME));

  for (const [migration, tables] of Object.entries(EXPECTED_TABLES)) {
    const missing = tables.filter((t) => !existing.has(t));
    if (missing.length) {
      console.log(`${BAD}${migration}`);
      console.log(`         missing: ${missing.join(', ')}`);
      const num = migration.slice(0, 3);
      problems.push(num === '001'
        ? 'npm run migrate'
        : `npm run migrate:${num}`);
    } else {
      console.log(`${OK}${migration}`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Permissions catalog
  // -------------------------------------------------------------------------
  console.log('\n2. PERMISSIONS (are they seeded in the DB?)\n');

  const [permRows] = await conn.query(`SELECT DISTINCT permission FROM role_permissions`);
  const inDb = new Set(permRows.map((r) => r.permission));
  const missingPerms = ALL_PERMISSIONS.filter((p) => !inDb.has(p));

  if (missingPerms.length) {
    console.log(`${BAD}${missingPerms.length} permissions are missing from the DB`);
    console.log(`         ${missingPerms.join(', ')}`);
    problems.push('npm run seed');
  } else {
    console.log(`${OK}All ${ALL_PERMISSIONS.length} permissions are present`);
  }

  // -------------------------------------------------------------------------
  // 3. Feature-wise — which page is visible to which role
  // -------------------------------------------------------------------------
  console.log('\n3. NEW FEATURES — which roles will see them\n');

  const [roles] = await conn.query(`SELECT type_id, name FROM roles ORDER BY type_id`);

  for (const [feature, perms] of Object.entries(FEATURE_PERMS)) {
    const [holders] = await conn.query(
      `SELECT DISTINCT r.name FROM role_permissions rp
       INNER JOIN roles r ON r.type_id = rp.role_id
       WHERE rp.permission IN (${perms.map(() => '?').join(',')})`,
      perms
    );

    if (!holders.length) {
      console.log(`${BAD}${feature}`);
      console.log('         No role has it — that is why it is not showing in the sidebar');
    } else {
      console.log(`${OK}${feature}`);
      console.log(`         roles: ${holders.map((h) => h.name).join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Admins — what your own account can see
  // -------------------------------------------------------------------------
  console.log('\n4. ADMIN ACCOUNTS\n');

  const [admins] = await conn.query(
    `SELECT a.admin_id, a.admin_username, a.status, r.name AS role_name, r.type_id,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = a.user_type) AS perms
     FROM admins a LEFT JOIN roles r ON r.type_id = a.user_type
     ORDER BY a.admin_id`
  );

  for (const a of admins) {
    const tag = a.perms >= ALL_PERMISSIONS.length ? OK : a.perms > 0 ? WARN : BAD;
    console.log(`${tag}${a.admin_username.padEnd(18)} ${String(a.role_name || '?').padEnd(18)} ${a.perms} permissions  [${a.status}]`);
  }

  // -------------------------------------------------------------------------
  // 5. Env
  // -------------------------------------------------------------------------
  console.log('\n5. ENV — what is configured\n');

  const envChecks = [
    ['S3 (media storage)', ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']],
    ['Legacy media source', ['LEGACY_MEDIA_BASE_URL']],
    ['Razorpay', ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']],
    ['PayU', ['PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT']],
    ['DTDC', ['DTDC_API_KEY', 'DTDC_CUSTOMER_CODE']],
    ['Fast2SMS', ['TWOFACTOR_API_KEY']],
    ['WhatsApp', ['WA_USER', 'WA_PASS']],
    ['Firebase push', ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON']],
  ];

  for (const [label, keys] of envChecks) {
    const set = keys.filter((k) => process.env[k]);
    if (label === 'Firebase push') {
      // either one of the two is enough
      console.log(`${set.length ? OK : WARN}${label.padEnd(24)} ${set.length ? 'configured' : 'not configured'}`);
      continue;
    }
    if (set.length === keys.length) {
      console.log(`${OK}${label.padEnd(24)} configured`);
    } else if (set.length === 0) {
      console.log(`${WARN}${label.padEnd(24)} not configured`);
    } else {
      console.log(`${BAD}${label.padEnd(24)} aadha configured — missing: ${keys.filter((k) => !process.env[k]).join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // FIX
  // -------------------------------------------------------------------------
  if (args.fix && missingPerms.length) {
    console.log('\n--- FIX: inserting missing permissions ---\n');

    for (const role of DEFAULT_ROLES) {
      const [[row]] = await conn.query(`SELECT type_id FROM roles WHERE name = ?`, [role.name]);
      if (!row) continue;

      const [have] = await conn.query(
        `SELECT permission FROM role_permissions WHERE role_id = ?`, [row.type_id]
      );
      const haveSet = new Set(have.map((h) => h.permission));
      const toAdd = role.permissions.filter((p) => !haveSet.has(p));

      if (toAdd.length) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission) VALUES ?`,
          [toAdd.map((p) => [row.type_id, p])]
        );
        console.log(`  ${role.name}: +${toAdd.length} permissions`);
      }
    }
    console.log('\n  Done. Now LOG OUT of the admin panel and LOG IN again.\n');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n=========== KYA KARNA HAI ===========\n');

  if (!problems.length) {
    console.log('  Everything looks fine on the backend side.\n');
    console.log('  If nothing new still shows up in admin:\n');
    console.log('    1. Have the admin panel files been replaced? (System.jsx, Sidebar.jsx, App.jsx)');
    console.log('    2. Was the admin panel rebuilt/restarted? (npm run dev)');
    console.log('    3. LOG OUT and LOG IN again — permissions are loaded at login');
    console.log('    4. Browser hard refresh: Ctrl+Shift+R');
    console.log('    5. The RBAC cache lasts 5 min — either wait, or run:  npm run db:locks');
  } else {
    const unique = [...new Set(problems)];
    unique.forEach((cmd, i) => console.log(`  ${i + 1}. ${cmd}`));
    console.log(`  ${unique.length + 1}. Admin panel me logout -> login`);
  }
  console.log('');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[doctor] FAILED:', err.sqlMessage || err.message);
  console.error('\nAre the DB credentials in .env correct? DB_NAME =', process.env.DB_NAME);
  process.exit(1);
});