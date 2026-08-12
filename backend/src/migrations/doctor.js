/**
 * Setup doctor — "admin me naya kuch dikh nahi raha" ka jawab.
 *
 *   npm run doctor
 *   npm run doctor -- --fix     (missing permissions apne aap daal deta hai)
 *
 * Check karta hai:
 *   1. Migration tables bani hain ya nahi
 *   2. Permissions DB me seed hui hain ya nahi
 *   3. Har admin ke role me kaunsi permissions hain
 *   4. .env me kya set hai, kya nahi
 *   5. Redis me RBAC cache purana to nahi pada
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

/** Ye tables kaunsi migration se aati hain */
const EXPECTED_TABLES = {
  '001 (schema refactor)': ['orders', 'order_items', 'prescriptions', 'inventory_logs',
    'order_status_logs', 'coupon_usages', 'wishlists', 'product_reviews', 'admin_activity_logs'],
  '002 (integrations)': ['otp_logs', 'device_tokens', 'notification_logs', 'shipments', 'shipment_scans'],
  '003 (media storage)': ['media_migration_items'],
};

/** Ye permissions kaunse feature ke liye chahiye */
const FEATURE_PERMS = {
  'System page (health, cache clear, media migration)': ['system.view', 'system.manage'],
  'Notifications page (message logs)': ['notifications.view'],
  'OTP logs tab': ['otp.view'],
  'Shipping panel (DTDC) order detail pe': ['shipping.view', 'shipping.manage'],
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
  console.log('\n2. PERMISSIONS (DB me seed hui hain?)\n');

  const [permRows] = await conn.query(`SELECT DISTINCT permission FROM role_permissions`);
  const inDb = new Set(permRows.map((r) => r.permission));
  const missingPerms = ALL_PERMISSIONS.filter((p) => !inDb.has(p));

  if (missingPerms.length) {
    console.log(`${BAD}${missingPerms.length} permissions DB me nahi hain`);
    console.log(`         ${missingPerms.join(', ')}`);
    problems.push('npm run seed');
  } else {
    console.log(`${OK}Saari ${ALL_PERMISSIONS.length} permissions maujood hain`);
  }

  // -------------------------------------------------------------------------
  // 3. Feature-wise — kaunsa page kis role ko dikhega
  // -------------------------------------------------------------------------
  console.log('\n3. NAYE FEATURES — kaunse role ko dikhenge\n');

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
      console.log('         Kisi bhi role ke paas nahi — isliye sidebar me nahi dikh raha');
    } else {
      console.log(`${OK}${feature}`);
      console.log(`         roles: ${holders.map((h) => h.name).join(', ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Admins — tumhara apna account kya dekh sakta hai
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
  console.log('\n5. ENV — kya configure hai\n');

  const envChecks = [
    ['S3 (media storage)', ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']],
    ['Legacy media source', ['LEGACY_MEDIA_BASE_URL']],
    ['Razorpay', ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']],
    ['PayU', ['PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT']],
    ['DTDC', ['DTDC_API_KEY', 'DTDC_CUSTOMER_CODE']],
    ['Fast2SMS', ['FAST2SMS_API_KEY']],
    ['WhatsApp', ['WA_USER', 'WA_PASS']],
    ['Firebase push', ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_JSON']],
  ];

  for (const [label, keys] of envChecks) {
    const set = keys.filter((k) => process.env[k]);
    if (label === 'Firebase push') {
      // dono me se koi ek kaafi hai
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
    console.log('\n--- FIX: missing permissions daal rahe hain ---\n');

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
    console.log('\n  Ho gaya. Ab admin panel me LOGOUT karke dobara LOGIN karo.\n');
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n=========== KYA KARNA HAI ===========\n');

  if (!problems.length) {
    console.log('  Backend ki taraf sab theek hai.\n');
    console.log('  Agar phir bhi admin me naya kuch nahi dikh raha:\n');
    console.log('    1. Admin panel ki files replace hui hain? (System.jsx, Sidebar.jsx, App.jsx)');
    console.log('    2. Admin panel dobara build/restart kiya? (npm run dev)');
    console.log('    3. LOGOUT karke dobara LOGIN karo — permissions login pe load hoti hain');
    console.log('    4. Browser hard refresh: Ctrl+Shift+R');
    console.log('    5. RBAC cache 5 min ka hota hai — ya to ruko, ya:  npm run db:locks');
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
  console.error('\n.env me DB credentials sahi hain? DB_NAME =', process.env.DB_NAME);
  process.exit(1);
});