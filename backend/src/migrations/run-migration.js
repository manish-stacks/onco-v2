/**
 * Migration runner.
 *   npm run migrate
 *
 * Purana version poori SQL file ek saath bhejta tha — isliye agar kahin atak
 * jaaye to pata hi nahi chalta tha ki kaunse statement pe atka hai. Ab har
 * statement alag chalta hai, uska naam aur time print hota hai.
 *
 * Resumable hai: agar pehli baar beech me ruk gaya tha, dobara chalao — jo
 * steps ho chuke hain wo "skip" bol ke aage badh jaayenge.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

/**
 * Ye errors ka matlab hai "ye step pehle hi ho chuka hai" — inpe rukna nahi.
 * Baaki koi bhi error aaye to migration turant band ho jaayegi.
 */
const ALREADY_DONE = {
  1050: 'table pehle se maujood hai',
  1051: 'table nahi mili (rename ho chuka hoga)',
  1060: 'column pehle se maujood hai',
  1061: 'index pehle se maujood hai',
  1091: 'column/key pehle se hat chuka hai',
  1146: 'table nahi mili (rename ho chuka hoga)',
};

/** SQL file ko statements me todo — comments hata ke */
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

/** Statement ka chhota label — log me kya chal raha hai wo dikhe */
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
 * ek hi unit hai — agar `y` pehle se maujood hai to poora ALTER fail ho
 * jaata hai aur `z` kabhi add nahi hota. Isliye 1060/1061 pe hum ALTER ko
 * tod ke har clause alag chalate hain, jo ho chuke hain wo skip ho jaate hain.
 *
 * Comma sirf top level pe todna hai — `(a, b)` jaise index definitions
 * aur `ENUM('web','app')` ke andar wale commas chhodne hain.
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

/** ALTER ke har clause ko alag chalao — jo ho chuka hai wo skip */
async function runAlterClauseByClause(conn, stmt, indent = '        ') {
  const parsed = splitAlterClauses(stmt);
  if (!parsed || parsed.clauses.length < 2) return false;

  console.log(`${indent}ALTER ko ${parsed.clauses.length} clauses me tod ke chala rahe hain...`);

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
   * Agar koi aur connection in tables ko pakde baitha hai (backend server
   * chal raha ho, ya phpMyAdmin me koi query khuli ho) to ALTER/RENAME
   * hamesha ke liye atak jaata hai. 30 second baad fail ho jaao, taaki
   * saaf error mile "hang" ki jagah.
   */
  await conn.query('SET SESSION lock_wait_timeout = 30');
  await conn.query('SET SESSION innodb_lock_wait_timeout = 30');

  const sql = fs.readFileSync(path.join(__dirname, '001_schema_refactor.sql'), 'utf8');
  const statements = splitStatements(sql);

  console.log(`[migrate] ${statements.length} statements chalane hain\n`);
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
        // ALTER hai to poora skip mat karo — baaki clauses reh jaayenge.
        // Tod ke chalao, jo ho chuka hai wo apne aap skip ho jaayega.
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
  Table lock pe atak gaya (${(ms / 1000).toFixed(0)}s wait karke chhoda).

  Koi aur connection in tables ko pakde baitha hai. Aksar ye hota hai:

    1. Backend server chal raha hai            -> band karo (Ctrl+C)
    2. phpMyAdmin me koi tab khuli hai         -> tabs band karo
    3. MySQL Workbench / DBeaver connected hai -> disconnect karo

  Kaun pakde hai ye dekhne ke liye MySQL me chalao:

    SHOW FULL PROCESSLIST;

  Jis row ka State = "Waiting for table metadata lock" ho, uske
  upar wali (zyada Time wali) query ki Id note karke:

    KILL <id>;

  Phir dobara: npm run migrate
------------------------------------------------------------------`);
        await conn.end();
        process.exit(1);
      }

      console.log('FAIL');
      console.error(`
------------------------------------------------------------------
  Statement #${i + 1} fail hua

  Error   : ${err.code} (${err.errno})
  Message : ${err.sqlMessage || err.message}

  SQL:
${stmt.slice(0, 500)}${stmt.length > 500 ? '\n  ...' : ''}

  Jitne statements chal chuke hain wo apply ho chuke hain. Problem
  theek karke dobara "npm run migrate" chalao -- ho chuke steps
  automatically skip ho jaayenge.
------------------------------------------------------------------`);
      await conn.end();
      process.exit(1);
    }
  }

  console.log('-'.repeat(66));
  console.log(`\n[migrate] ${done} statements chale, ${skipped} skip hue (pehle se done)\n`);

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
  console.log('\nCounts theek lagein to purani tables manually drop karo:');
  console.log(`  DROP TABLE cp_order_details, cp_app_order_details, cp_order_temp,
    cp_temp_order, cp_temp_order_details, cp_prescription,
    cp_app_prescription, cp_prescription_medicine;`);
  console.log('\nAb permissions seed karo:  npm run seed');

  await conn.end();
}

main().catch((err) => {
  console.error('\n[migrate] FAILED:', err.message);
  process.exit(1);
});
