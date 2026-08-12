/**
 * LOCAL DEV — purana data hata ke DB chhota karo.
 *
 *   npm run trim -- --orders=50
 *   npm run trim -- --orders=50 --prescriptions=50 --yes
 *
 * Kyun chahiye: production dump me 34,000+ orders hain. Local pe develop
 * karne ke liye 50 kaafi hain, aur migration ka `ALTER TABLE orders` poori
 * table rebuild karta hai — 34k rows pe minutes lagte hain, 50 rows pe
 * milliseconds.
 *
 * PURANE aur NAYE dono schema pe chalta hai — migration se pehle ya baad,
 * jab bhi chalao.
 *
 * ⚠ Ye data PERMANENTLY delete karta hai. Production pe kabhi mat chalana.
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
    console.error('[trim] NODE_ENV=production hai. Ye script production pe nahi chalegi.');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
  });

  // Migration se pehle purane naam hain, baad me naye — dono handle karo
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
    console.error(`[trim] "${T.orders}" table nahi mili. DB sahi hai?`);
    await conn.end();
    process.exit(1);
  }

  if (totalOrders <= keepOrders) {
    console.log(`[trim] Pehle se sirf ${totalOrders} orders hain — kuch delete karne ki zaroorat nahi.`);
    await conn.end();
    return;
  }

  // Nth latest order ka id — usse purane sab delete honge
  const [[cutoffRow]] = await conn.query(
    `SELECT order_id FROM \`${T.orders}\` ORDER BY order_id DESC LIMIT 1 OFFSET ?`,
    [keepOrders - 1]
  );
  const cutoff = cutoffRow.order_id;
  const willDelete = totalOrders - keepOrders;

  console.log('  Kya delete hoga');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  ${T.orders.padEnd(24)} ${String(willDelete).padStart(7)} rows  (${keepOrders} latest bachenge)`);

  for (const t of T.items) {
    const c = await count(conn, t);
    if (c !== null) {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) n FROM \`${t}\` WHERE order_id < ?`, [cutoff]);
      console.log(`  ${t.padEnd(24)} ${String(n).padStart(7)} rows`);
    }
  }

  // temp tables ab use nahi hoti — poori khaali kar do
  const tempTables = ['cp_order_temp', 'cp_temp_order', 'cp_temp_order_details'];
  for (const t of tempTables) {
    const c = await count(conn, t);
    if (c) console.log(`  ${t.padEnd(24)} ${String(c).padStart(7)} rows  (poori khaali hogi)`);
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
    const answer = await confirm('  Ye data permanently delete ho jayega. Aage badhein? (haan/no): ');
    if (!['haan', 'y', 'yes', 'ha'].includes(answer)) {
      console.log('\n[trim] Cancel kar diya. Kuch delete nahi hua.');
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
      if (err.errno === 1146) { console.log('skip (table nahi hai)'); return; }
      console.log('FAIL');
      throw err;
    }
  };

  console.log('  Delete kar rahe hain');
  console.log('  ─────────────────────────────────────────────');

  // Bachhe pehle, parent baad me — warna orphan reh jaate hain
  for (const t of T.items) {
    await step(`${t} (purane items)`, `DELETE FROM \`${t}\` WHERE order_id < ?`, [cutoff]);
  }

  if (migrated) {
    await step('order_status_logs', 'DELETE FROM `order_status_logs` WHERE order_id < ?', [cutoff]);
    await step('coupon_usages', 'DELETE FROM `coupon_usages` WHERE order_id < ?', [cutoff]);
    await step('inventory_logs (order wale)',
      "DELETE FROM `inventory_logs` WHERE reference_type = 'order' AND reference_id < ?", [cutoff]);
  }

  await step(`${T.orders} (purane orders)`, `DELETE FROM \`${T.orders}\` WHERE order_id < ?`, [cutoff]);

  for (const t of tempTables) {
    await step(`${t} (khaali)`, `DELETE FROM \`${t}\``);
  }

  if (prescCutoff) {
    // Jo prescriptions bache hue orders se judi hain unhe mat chhedo
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
  console.log(`[trim] Ho gaya. ${T.orders} me ab ${after} orders hain.\n`);
  console.log('  Space wapas paane ke liye (optional, thoda time lega):');
  console.log(`    OPTIMIZE TABLE \`${T.orders}\`;\n`);
  if (!migrated) console.log('  Ab migration chalao:  npm run migrate\n');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[trim] FAILED:', err.sqlMessage || err.message);
  process.exit(1);
});
