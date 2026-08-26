/**
 * Migration runner.
 *   npm run migrate
 *
 * The old version sent the whole SQL file at once — so if it got stuck somewhere
 * there was no way to tell which statement it got stuck on. Now every
 * statement runs separately and its name and time are printed.
 *
 * Resumable: if the first run stopped midway, run it again — whatever
 * steps that are already done simply report "skip" and move on.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

/**
 * These errors mean "this step has already been done" — do not stop on them.
 * Any other error stops the migration immediately.
 */
const ALREADY_DONE = {
  1050: 'table already exists',
  1051: 'table not found (it may already be renamed)',
  1060: 'column already exists',
  1061: 'index already exists',
  1091: 'column/key has already been dropped',
  1146: 'table not found (it may already be renamed)',
  // A foreign key with this exact name is already on the table, which only
  // happens when this migration has already added it on an earlier run.
  1826: 'foreign key constraint already exists',
  1022: 'duplicate key name',
};

/** Split the SQL file into statements — stripping comments */
function splitStatements(sql) {
  const cleaned = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** A short label for the statement — so the log shows what is running */
function label(stmt) {
  const oneLine = stmt.replace(/\s+/g, ' ').trim();
  const patterns = [
    [/^RENAME TABLE `(\w+)` TO `(\w+)`/i, (m) => `RENAME  ${m[1]} -> ${m[2]}`],
    [/^CREATE TABLE IF NOT EXISTS `(\w+)`/i, (m) => `CREATE  ${m[1]}`],
    [/^ALTER TABLE `(\w+)`/i, (m) => `ALTER   ${m[1]}`],
    [/^INSERT INTO `(\w+)`/i, (m) => `INSERT  -> ${m[1]}`],
    [/^UPDATE `?(\w+)`?/i, (m) => `UPDATE  ${m[1]}`],
    [/^SET (\w+)/i, (m) => `SET     ${m[1]}`],
    [/^DROP TABLE IF EXISTS `(\w+)`/i, (m) => `DROP    ${m[1]}`],
  ];
  for (const [re, fn] of patterns) {
    const m = oneLine.match(re);
    if (m) return fn(m);
  }
  return oneLine.slice(0, 60);
}

async function safeCount(conn, table) {
  try {
    const [[row]] = await conn.query(`SELECT COUNT(*) c FROM \`${table}\``);
    return row.c;
  } catch {
    return 'N/A';
  }
}

/**
 * Ek bade ALTER ko alag-alag clauses me todo.
 *
 * Zaroorat kyun: `ALTER TABLE orders MODIFY x, ADD COLUMN y, ADD INDEX z`
 * is a single unit — if `y` already exists the whole ALTER fails
 * and `z` is never added. So on 1060/1061 we split the ALTER
 * we split it and run each clause separately; the ones already applied are skipped.
 *
 * Only split on top-level commas — index definitions such as `(a, b)`
 * and commas inside `ENUM('web','app')` must be left alone.
 */
function splitAlterClauses(stmt) {
  const m = stmt.match(/^ALTER TABLE\s+(`?\w+`?)\s+([\s\S]+)$/i);
  if (!m) return null;

  const table = m[1];
  const body = m[2];

  const clauses = [];
  let current = '';
  let depth = 0;
  let quote = null;

  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];

    if (quote) {
      current += c;
      if (c === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; current += c; continue; }
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;

    if (c === ',' && depth === 0) {
      clauses.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) clauses.push(current.trim());

  return { table, clauses };
}

/** Run each clause of an ALTER separately — skip the ones already applied */
async function runAlterClauseByClause(conn, stmt, indent = '        ') {
  const parsed = splitAlterClauses(stmt);
  if (!parsed || parsed.clauses.length < 2) return false;

  console.log(`${indent}Splitting the ALTER into ${parsed.clauses.length} clauses and running them...`);

  let applied = 0;
  for (const clause of parsed.clauses) {
    const short = clause.replace(/\s+/g, ' ').slice(0, 52);
    try {
      await conn.query(`ALTER TABLE ${parsed.table} ${clause}`);
      console.log(`${indent}  + ${short.padEnd(54)} ok`);
      applied += 1;
    } catch (err) {
      if (ALREADY_DONE[err.errno]) {
        console.log(`${indent}  · ${short.padEnd(54)} skip`);
      } else {
        console.log(`${indent}  ! ${short.padEnd(54)} FAIL`);
        throw err;
      }
    }
  }
  console.log(`${indent}${applied} naye clause apply hue`);
  return true;
}

async function main() {
  const dbName = process.env.DB_NAME;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    multipleStatements: false, // ek-ek karke chalayenge
  });

  console.log(`[migrate] connected to ${dbName}\n`);

  /**
   * If some other connection is holding these tables (backend server
   * is running, or a query is open in phpMyAdmin) then ALTER/RENAME
   * it hangs forever. Fail after 30 seconds, so that
   * a clear error is returned instead of a "hang".
   */
  await conn.query('SET SESSION lock_wait_timeout = 30');
  await conn.query('SET SESSION innodb_lock_wait_timeout = 30');

  const sql = fs.readFileSync(path.join(__dirname, '001_schema_refactor.sql'), 'utf8');
  const statements = splitStatements(sql);

  console.log(`[migrate] ${statements.length} statements to run\n`);
  console.log('-'.repeat(66));

  let done = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const name = label(stmt);
    const tag = `[${String(i + 1).padStart(2, '0')}/${statements.length}]`;

    process.stdout.write(`${tag} ${name.padEnd(44)}`);
    const start = Date.now();

    try {
      await conn.query(stmt);
      const ms = Date.now() - start;
      console.log(`ok    ${ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}`);
      done += 1;
    } catch (err) {
      const ms = Date.now() - start;

      if (ALREADY_DONE[err.errno]) {
        // If it is an ALTER do not skip it entirely — the remaining clauses would be lost.
        // Split it and run it; whatever is already applied is skipped automatically.
        if (/^ALTER TABLE/i.test(stmt)) {
          console.log('partial');
          try {
            const handled = await runAlterClauseByClause(conn, stmt);
            if (handled) { done += 1; continue; }
          } catch (retryErr) {
            console.error(`\n  ALTER clause fail: ${retryErr.sqlMessage || retryErr.message}\n`);
            await conn.end();
            process.exit(1);
          }
        }
        console.log(`skip  (${ALREADY_DONE[err.errno]})`);
        skipped += 1;
        continue;
      }

      if (err.errno === 1205 || err.code === 'ER_LOCK_WAIT_TIMEOUT') {
        console.log('LOCKED');
        console.error(`
------------------------------------------------------------------
  Stuck on a table lock (gave up after waiting ${(ms / 1000).toFixed(0)}s).

  Another connection is holding these tables. Usually this is:

    1. The backend server is running          -> stop it (Ctrl+C)
    2. A phpMyAdmin tab is open               -> close the tabs
    3. MySQL Workbench / DBeaver is connected -> disconnect

  To see who is holding it, run this in MySQL:

    SHOW FULL PROCESSLIST;

  For the row whose State = "Waiting for table metadata lock",
  note the Id of the query above (the one with the higher Time) and run:

    KILL <id>;

  Then run it again: npm run migrate
------------------------------------------------------------------`);
        await conn.end();
        process.exit(1);
      }

      console.log('FAIL');
      console.error(`
------------------------------------------------------------------
  Statement #${i + 1} fail after ${(ms / 1000).toFixed(0)}s

  Error   : ${err.code} (${err.errno})
  Message : ${err.sqlMessage || err.message}

  SQL:
${stmt.slice(0, 500)}${stmt.length > 500 ? '\n  ...' : ''}

  Whatever statements have run are already applied. The problem
  fix it and run "npm run migrate" again -- the completed steps
  will be skipped automatically.
------------------------------------------------------------------`);
      await conn.end();
      process.exit(1);
    }
  }

  console.log('-'.repeat(66));
  console.log(`\n[migrate] ${done} statements ran, ${skipped} skipped (already done)\n`);

  // ---- verification ----
  const oldWeb = await safeCount(conn, 'cp_order_details');
  const oldApp = await safeCount(conn, 'cp_app_order_details');
  const oldPrescWeb = await safeCount(conn, 'cp_prescription');
  const oldPrescApp = await safeCount(conn, 'cp_app_prescription');
  const newItems = await safeCount(conn, 'order_items');
  const newPresc = await safeCount(conn, 'prescriptions');
  const orders = await safeCount(conn, 'orders');
  const products = await safeCount(conn, 'products');

  console.log('================ VERIFY =================');
  console.log(`cp_order_details (web)        : ${oldWeb}`);
  console.log(`cp_app_order_details (app)    : ${oldApp}`);
  console.log(`-> order_items (merged)       : ${newItems}`);
  console.log('');
  console.log(`cp_prescription (web)         : ${oldPrescWeb}`);
  console.log(`cp_app_prescription (app)     : ${oldPrescApp}`);
  console.log(`-> prescriptions (merged)     : ${newPresc}`);
  console.log('');
  console.log(`orders                        : ${orders}`);
  console.log(`products                      : ${products}`);
  console.log('=========================================');
  console.log('\nIf the counts look right, drop the old tables manually:');
  console.log(`  DROP TABLE cp_order_details, cp_app_order_details, cp_order_temp,
    cp_temp_order, cp_temp_order_details, cp_prescription,
    cp_app_prescription, cp_prescription_medicine;`);
  console.log('\nNow seed the permissions:  npm run seed');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[migrate] FAILED:', err.message);
  process.exit(1);
});
