/**
 * LOCAL DEV — shrink the DB by removing old data.
 *
 *   npm run trim -- --orders=50
 *   npm run trim -- --orders=50 --prescriptions=50 --yes
 *
 * Why it is needed: the production dump has 34,000+ orders. Developing locally
 * 50 is plenty for development, and the migration's `ALTER TABLE orders` rebuilds the whole
 * table — that takes minutes on 34k rows, and seconds on 50
 * milliseconds.
 *
 * Works on BOTH the OLD and NEW schema — before or after the migration,
 * whenever you run it.
 *
 * ⚠ This deletes data PERMANENTLY. Never run it in production.
 */
require('dotenv').config();
const readline = require('readline');
const mysql = require('mysql2/promise');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  });
  return args;
}

async function tableExists(conn, dbName, table) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema=? AND table_name=?`,
    [dbName, table]
  );
  return row.c > 0;
}

async function count(conn, table) {
  try {
    const [[row]] = await conn.query(`SELECT COUNT(*) c FROM \`${table}\``);
    return row.c;
  } catch {
    return null;
  }
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(question, res));
  rl.close();
  return answer.trim().toLowerCase();
}

async function main() {
  const args = parseArgs();
  const keepOrders = parseInt(args.orders, 10) || 50;
  const keepPrescriptions = args.prescriptions ? parseInt(args.prescriptions, 10) : null;
  const dbName = process.env.DB_NAME;

  if (process.env.NODE_ENV === 'production') {
    console.error('[trim] NODE_ENV=production. This script will not run in production.');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
  });

  // Before the migration the names are old, after it they are new — handle both
  const migrated = await tableExists(conn, dbName, 'order_items');
  const T = migrated
    ? { orders: 'orders', items: ['order_items'], prescriptions: 'prescriptions', prescIdCol: 'prescription_id' }
    : {
      orders: 'cp_order',
      items: ['cp_order_details', 'cp_app_order_details'],
      prescriptions: 'cp_prescription',
      prescIdCol: 'prescription_id',
    };

  console.log(`[trim] DB: ${dbName}`);
  console.log(`[trim] Schema: ${migrated ? 'migrated (naye naam)' : 'original (cp_* naam)'}\n`);

  const totalOrders = await count(conn, T.orders);
  if (totalOrders === null) {
    console.error(`[trim] Table "${T.orders}" not found. Is the DB correct?`);
    await conn.end();
    process.exit(1);
  }

  if (totalOrders <= keepOrders) {
    console.log(`[trim] There are only ${totalOrders} orders already — nothing needs to be deleted.`);
    await conn.end();
    return;
  }

  // The id of the Nth latest order — everything older than it is deleted
  const [[cutoffRow]] = await conn.query(
    `SELECT order_id FROM \`${T.orders}\` ORDER BY order_id DESC LIMIT 1 OFFSET ?`,
    [keepOrders - 1]
  );
  const cutoff = cutoffRow.order_id;
  const willDelete = totalOrders - keepOrders;

  console.log('  What will be deleted');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  ${T.orders.padEnd(24)} ${String(willDelete).padStart(7)} rows  (${keepOrders} latest will be kept)`);

  for (const t of T.items) {
    const c = await count(conn, t);
    if (c !== null) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) n FROM \`${t}\` WHERE order_id < ?`, [cutoff]);
      console.log(`  ${t.padEnd(24)} ${String(n).padStart(7)} rows`);
    }
  }

  // the temp tables are no longer used — empty them completely
  const tempTables = ['cp_order_temp', 'cp_temp_order', 'cp_temp_order_details'];
  for (const t of tempTables) {
    const c = await count(conn, t);
    if (c) console.log(`  ${t.padEnd(24)} ${String(c).padStart(7)} rows  (will be emptied completely)`);
  }

  let prescCutoff = null;
  if (keepPrescriptions) {
    const totalPresc = await count(conn, T.prescriptions);
    if (totalPresc && totalPresc > keepPrescriptions) {
      const [[row]] = await conn.query(
        `SELECT \`${T.prescIdCol}\` AS id FROM \`${T.prescriptions}\`
         ORDER BY \`${T.prescIdCol}\` DESC LIMIT 1 OFFSET ?`,
        [keepPrescriptions - 1]
      );
      prescCutoff = row.id;
      console.log(`  ${T.prescriptions.padEnd(24)} ${String(totalPresc - keepPrescriptions).padStart(7)} rows  (${keepPrescriptions} latest bachenge)`);
    }
  }
  console.log('  ─────────────────────────────────────────────\n');

  if (!args.yes) {
    const answer = await confirm('  This data will be permanently deleted. Continue? (yes/no): ');
    if (!['haan', 'y', 'yes', 'ha'].includes(answer)) {
      console.log('\n[trim] Cancelled. Nothing was deleted.');
      await conn.end();
      return;
    }
    console.log('');
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('SET SESSION lock_wait_timeout = 30');

  const step = async (label, sql, params = []) => {
    process.stdout.write(`  ${label.padEnd(46)}`);
    const start = Date.now();
    try {
      const [res] = await conn.query(sql, params);
      const ms = Date.now() - start;
      console.log(`ok  ${String(res.affectedRows ?? 0).padStart(7)} rows  ${ms}ms`);
    } catch (err) {
      if (err.errno === 1146) { console.log('skip (table does not exist)'); return; }
      console.log('FAIL');
      throw err;
    }
  };

  console.log('  Deleting');
  console.log('  ─────────────────────────────────────────────');

  // Children first, parents after — otherwise they are left orphaned
  for (const t of T.items) {
    await step(`${t} (purane items)`, `DELETE FROM \`${t}\` WHERE order_id < ?`, [cutoff]);
  }

  if (migrated) {
    await step('order_status_logs', 'DELETE FROM `order_status_logs` WHERE order_id < ?', [cutoff]);
    await step('coupon_usages', 'DELETE FROM `coupon_usages` WHERE order_id < ?', [cutoff]);
    await step('inventory_logs (order related)',
      "DELETE FROM `inventory_logs` WHERE reference_type = 'order' AND reference_id < ?", [cutoff]);
  }

  await step(`${T.orders} (purane orders)`, `DELETE FROM \`${T.orders}\` WHERE order_id < ?`, [cutoff]);

  for (const t of tempTables) {
    await step(`${t} (khaali)`, `DELETE FROM \`${t}\``);
  }

  if (prescCutoff) {
    // Leave prescriptions attached to surviving orders untouched
    await step(`${T.prescriptions} (purane)`,
      `DELETE FROM \`${T.prescriptions}\`
       WHERE \`${T.prescIdCol}\` < ?
         AND \`${T.prescIdCol}\` NOT IN (
           SELECT prescription_id FROM (
             SELECT DISTINCT prescription_id FROM \`${T.orders}\` WHERE prescription_id IS NOT NULL
           ) kept
         )`,
      [prescCutoff]);

    if (!migrated) {
      await step('cp_app_prescription (purane)', 'DELETE FROM `cp_app_prescription` WHERE id < ?', [prescCutoff]);
    }
  }

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('  ─────────────────────────────────────────────\n');

  const after = await count(conn, T.orders);
  console.log(`[trim] Done. ${T.orders} now has ${after} orders.\n`);
  console.log('  To reclaim space (optional, takes a little time):');
  console.log(`    OPTIMIZE TABLE \`${T.orders}\`;\n`);
  if (!migrated) console.log('  Ab migration chalao:  npm run migrate\n');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[trim] FAILED:', err.sqlMessage || err.message);
  process.exit(1);
});
