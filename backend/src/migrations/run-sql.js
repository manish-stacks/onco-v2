/**
 * Kisi bhi migration file ko chalao.
 *
 *   npm run migrate            -> 001_schema_refactor.sql
 *   npm run migrate:002        -> 002_integrations.sql
 *   node src/migrations/run-sql.js 002_integrations.sql
 *
 * Wahi resumable behaviour jo run-migration.js me hai — har statement alag,
 * "pehle se ho chuka" wale errors skip, bade ALTER clause-by-clause.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ALREADY_DONE = {
  1050: 'table pehle se maujood hai',
  1051: 'table nahi mili (rename ho chuka hoga)',
  1060: 'column pehle se maujood hai',
  1061: 'index pehle se maujood hai',
  1091: 'column/key pehle se hat chuka hai',
  1146: 'table nahi mili (rename ho chuka hoga)',
};

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function label(stmt) {
  const one = stmt.replace(/\s+/g, ' ').trim();
  const pats = [
    [/^RENAME TABLE `(\w+)` TO `(\w+)`/i, (m) => `RENAME  ${m[1]} -> ${m[2]}`],
    [/^CREATE TABLE IF NOT EXISTS `(\w+)`/i, (m) => `CREATE  ${m[1]}`],
    [/^ALTER TABLE `(\w+)`/i, (m) => `ALTER   ${m[1]}`],
    [/^INSERT INTO `(\w+)`/i, (m) => `INSERT  -> ${m[1]}`],
    [/^UPDATE `?(\w+)`?/i, (m) => `UPDATE  ${m[1]}`],
    [/^SET (\w+)/i, (m) => `SET     ${m[1]}`],
    [/^DROP TABLE IF EXISTS `(\w+)`/i, (m) => `DROP    ${m[1]}`],
  ];
  for (const [re, fn] of pats) {
    const m = one.match(re);
    if (m) return fn(m);
  }
  return one.slice(0, 60);
}

function splitAlterClauses(stmt) {
  const m = stmt.match(/^ALTER TABLE\s+(`?\w+`?)\s+([\s\S]+)$/i);
  if (!m) return null;
  const [, table, body] = m;

  const clauses = [];
  let cur = '';
  let depth = 0;
  let quote = null;

  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (quote) {
      cur += c;
      if (c === quote && body[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ',' && depth === 0) { clauses.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) clauses.push(cur.trim());
  return { table, clauses };
}

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
      if (ALREADY_DONE[err.errno]) console.log(`${indent}  . ${short.padEnd(54)} skip`);
      else { console.log(`${indent}  ! ${short.padEnd(54)} FAIL`); throw err; }
    }
  }
  console.log(`${indent}${applied} naye clause apply hue`);
  return true;
}

async function main() {
  const file = process.argv[2] || '001_schema_refactor.sql';
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.error(`[migrate] File nahi mili: ${file}`);
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  await conn.query('SET SESSION lock_wait_timeout = 30');
  await conn.query('SET SESSION innodb_lock_wait_timeout = 30');

  const statements = splitStatements(fs.readFileSync(filePath, 'utf8'));
  console.log(`\n[migrate] ${process.env.DB_NAME} <- ${file}`);
  console.log(`[migrate] ${statements.length} statements\n`);
  console.log('-'.repeat(66));

  let done = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const tag = `[${String(i + 1).padStart(2, '0')}/${statements.length}]`;
    process.stdout.write(`${tag} ${label(stmt).padEnd(44)}`);
    const start = Date.now();

    try {
      await conn.query(stmt);
      const ms = Date.now() - start;
      console.log(`ok    ${ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`}`);
      done += 1;
    } catch (err) {
      if (ALREADY_DONE[err.errno]) {
        if (/^ALTER TABLE/i.test(stmt)) {
          console.log('partial');
          try {
            if (await runAlterClauseByClause(conn, stmt)) { done += 1; continue; }
          } catch (e) {
            console.error(`\n  ALTER clause fail: ${e.sqlMessage || e.message}\n`);
            await conn.end(); process.exit(1);
          }
        }
        console.log(`skip  (${ALREADY_DONE[err.errno]})`);
        skipped += 1;
        continue;
      }

      if (err.errno === 1205 || err.code === 'ER_LOCK_WAIT_TIMEOUT') {
        console.log('LOCKED');
        console.error('\n  Table lock. Backend band karo, ya: npm run db:locks -- --kill\n');
        await conn.end(); process.exit(1);
      }

      console.log('FAIL');
      console.error(`\n  Statement #${i + 1}\n  ${err.code} (${err.errno}): ${err.sqlMessage || err.message}\n\n${stmt.slice(0, 400)}\n`);
      await conn.end(); process.exit(1);
    }
  }

  console.log('-'.repeat(66));
  console.log(`\n[migrate] ${done} chale, ${skipped} skip hue\n`);
  await conn.end();
}

main().catch((err) => {
  console.error('\n[migrate] FAILED:', err.sqlMessage || err.message);
  process.exit(1);
});
