/**
 * DB connections dekho aur atki hui queries kill karo.
 *
 *   npm run db:locks           -- sirf dikhao, kuch mat karo
 *   npm run db:locks -- --kill -- baaki saari connections kaat do
 *
 * Kab chahiye: migration "LOCKED" bol ke ruk jaye. Iska matlab koi aur
 * connection un tables ko pakde baitha hai, aur RENAME/ALTER metadata lock
 * ka intezaar kar raha hai.
 *
 * Local dev pe `--kill` sabse tez rasta hai. Production pe sochkar chalana —
 * kisi ki chal rahi query kat sakti hai.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((a) => {
    const m = a.match(/^--([\w-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  });
  return args;
}

function truncate(s, n) {
  if (!s) return '';
  const oneLine = String(s).replace(/\s+/g, ' ').trim();
  return oneLine.length > n ? `${oneLine.slice(0, n - 1)}…` : oneLine;
}

async function main() {
  const args = parseArgs();
  const dbName = process.env.DB_NAME;

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
  });

  const [[me]] = await conn.query('SELECT CONNECTION_ID() AS id');
  const myId = me.id;

  const [rows] = await conn.query(
    `SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, INFO
     FROM information_schema.PROCESSLIST
     ORDER BY TIME DESC`
  );

  // sirf hamare DB wali, aur apni connection chhod ke
  const others = rows.filter((r) => r.ID !== myId && (r.DB === dbName || r.DB === null));

  console.log(`\n[db:locks] DB: ${dbName}   (meri connection id: ${myId})\n`);

  if (!others.length) {
    console.log('  Koi aur connection nahi hai. Lock kisi aur wajah se hoga —');
    console.log('  XAMPP control panel se MySQL restart karke dekho.\n');
    await conn.end();
    return;
  }

  console.log('  ID     USER            TIME   COMMAND   STATE / QUERY');
  console.log('  ' + '-'.repeat(84));

  const blockers = [];

  others.forEach((r) => {
    const isBlocker =
      (r.STATE && /metadata lock|table lock|waiting for/i.test(r.STATE)) ||
      (r.COMMAND === 'Sleep' && r.TIME > 60) ||
      (r.COMMAND !== 'Sleep' && r.TIME > 10);

    if (isBlocker) blockers.push(r);

    const marker = isBlocker ? '>' : ' ';
    const detail = r.STATE ? `${r.STATE}` : truncate(r.INFO, 46) || '—';

    console.log(
      `${marker} ${String(r.ID).padEnd(6)} ${String(r.USER).padEnd(15)} ` +
      `${String(r.TIME).padStart(5)}s ${String(r.COMMAND).padEnd(9)} ${truncate(detail, 44)}`
    );
    if (r.STATE && r.INFO) {
      console.log(`  ${' '.repeat(38)}${truncate(r.INFO, 44)}`);
    }
  });

  console.log('  ' + '-'.repeat(84));
  console.log(`\n  ${others.length} doosri connection(s), ${blockers.length} shak ke daayre me (> se marked)\n`);

  if (!args.kill) {
    console.log('  Kaatne ke liye:  npm run db:locks -- --kill');
    console.log('  Ya XAMPP control panel se MySQL Stop -> Start (sabse tez).\n');
    await conn.end();
    return;
  }

  console.log('  Kill kar rahe hain...\n');
  let killed = 0;
  for (const r of others) {
    try {
      await conn.query(`KILL ${r.ID}`);
      console.log(`    killed ${r.ID}  (${r.USER}, ${r.TIME}s, ${r.COMMAND})`);
      killed += 1;
    } catch (err) {
      // connection khud hi band ho gayi ho to koi baat nahi
      if (err.errno !== 1094) console.log(`    ${r.ID} kill nahi hui: ${err.sqlMessage || err.message}`);
    }
  }

  console.log(`\n  ${killed} connections kat gayi. Ab chalao:  npm run migrate\n`);
  await conn.end();
}

main().catch((err) => {
  console.error('\n[db:locks] FAILED:', err.sqlMessage || err.message);
  process.exit(1);
});
