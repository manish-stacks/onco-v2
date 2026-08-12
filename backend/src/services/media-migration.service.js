const axios = require('axios');
const path = require('path');
const db = require('../config/db');
const storage = require('./storage.service');
const cache = require('../utils/cache');
const { parseJson } = require('../utils/helpers');
const { MEDIA_MAP, toSourceUrl, isMigrated, legacyBase } = require('../config/media');

/**
 * Purani site (oncohealthmart.com) pe padi images ko S3 pe le jaana.
 *
 * Do phase me:
 *   1. SCAN  — DB scan karke `media_migration_items` me kaam ki list banao
 *   2. RUN   — batch me (50/100) process karo: download -> S3 -> DB update
 *
 * Batch me isliye kyunki 10,000+ images ek request me nahi ho sakti — request
 * timeout ho jaayegi aur beech me fail hua to pata nahi chalega kahan tak hua.
 * Har item ka apna status hai, to jitni baar chalao, wahin se aage badhta hai.
 */

const BATCH_LIMIT = 200; // ek request me isse zyada nahi, chahe kuch bhi bolo

// ---------------------------------------------------------------------------
// SCAN
// ---------------------------------------------------------------------------

/**
 * DB scan karke pending items ki list banao.
 * Dobara chalane pe pehle se queued items duplicate nahi honge.
 */
async function scan({ tables } = {}) {
  const targets = tables?.length
    ? MEDIA_MAP.filter((m) => tables.includes(m.table))
    : MEDIA_MAP;

  const summary = [];

  for (const map of targets) {
    let found = 0;
    let queued = 0;
    let skipped = 0;

    const cols = map.columns.map((c) => `\`${c}\``).join(', ');
    const [rows] = await db.query(
      `SELECT \`${map.pk}\` AS pk, ${cols} FROM \`${map.table}\``
    );

    for (const row of rows) {
      for (const col of map.columns) {
        const raw = row[col];
        if (!raw) continue;

        // JSON array column (prescriptions.images) — har element alag item
        // json_index: -1 = normal column, 0+ = JSON array ka index.
        // NULL isliye nahi use karte kyunki MySQL ka UNIQUE index NULL ko
        // duplicate nahi maanta — dedupe tootjata hai.
        const values = map.json
          ? parseJson(raw, []).map((v, i) => ({ value: v, index: i }))
          : [{ value: raw, index: -1 }];

        for (const { value, index } of values) {
          if (!value) continue;
          found += 1;

          if (isMigrated(value)) { skipped += 1; continue; }

          const sourceUrl = toSourceUrl(value);
          if (!sourceUrl) { skipped += 1; continue; }

          const inserted = await queueItem({
            table: map.table,
            pk: map.pk,
            recordId: row.pk,
            column: col,
            jsonIndex: index,
            folder: map.folder,
            oldValue: value,
            sourceUrl,
          });
          if (inserted) queued += 1;
        }
      }
    }

    summary.push({
      table: map.table,
      found,                      // DB me kitni image values mili
      queued,                     // kitni NAYI queue hui (duplicate skip)
      already_migrated: skipped,  // pehle se S3 pe hain
    });
  }

  const [[{ pending }]] = await db.query(
    `SELECT COUNT(*) AS pending FROM media_migration_items WHERE status = 'pending'`
  );

  return { tables: summary, pending };
}

/** Duplicate na ho — same (table, record, column, index) dobara queue na kare */
async function queueItem(item) {
  try {
    const [res] = await db.query(
      `INSERT IGNORE INTO media_migration_items
        (source_table, pk_column, record_id, column_name, json_index, folder,
         old_value, source_url, status)
       VALUES (?,?,?,?,?,?,?,?, 'pending')`,
      [item.table, item.pk, item.recordId, item.column,
        item.jsonIndex ?? -1, item.folder, item.oldValue, item.sourceUrl]
    );
    return res.affectedRows > 0;
  } catch (err) {
    console.error('[media-migration] queue fail:', err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// RUN — batch processing
// ---------------------------------------------------------------------------

/**
 * Agla batch process karo.
 * @param {object} opts { limit, retryFailed, dryRun }
 */
async function runBatch({ limit = 50, retryFailed = false, dryRun = false, tables } = {}) {
  const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), BATCH_LIMIT);

  const statuses = retryFailed ? ['pending', 'failed'] : ['pending'];
  const params = [...statuses];

  // Sirf chuni hui tables — admin ne jo select kiya wahi migrate ho
  let tableFilter = '';
  if (tables?.length) {
    tableFilter = ` AND source_table IN (${tables.map(() => '?').join(',')})`;
    params.push(...tables);
  }

  const [items] = await db.query(
    `SELECT * FROM media_migration_items
     WHERE status IN (${statuses.map(() => '?').join(',')})${tableFilter}
     ORDER BY id ASC LIMIT ?`,
    [...params, size]
  );

  if (!items.length) {
    return { processed: 0, succeeded: 0, failed: 0, done: true, remaining: 0 };
  }

  const results = { processed: 0, succeeded: 0, failed: 0, errors: [] };

  for (const item of items) {
    results.processed += 1;
    try {
      if (dryRun) {
        results.succeeded += 1;
        continue;
      }
      await migrateOne(item);
      results.succeeded += 1;
    } catch (err) {
      results.failed += 1;
      results.errors.push({
        id: item.id,
        table: item.source_table,
        record_id: item.record_id,
        url: resolveUrl(item),
        error: err.message,
      });
      await db.query(
        `UPDATE media_migration_items
         SET status = 'failed', error = ?, attempts = attempts + 1, processed_at = NOW()
         WHERE id = ?`,
        [String(err.message).slice(0, 500), item.id]
      );
    }
  }

  // Images badli hain to product/category cache purani URLs de raha hoga
  if (results.succeeded > 0) {
    await cache.invalidate.all();
  }

  const remaining = await pendingCount(retryFailed, tables);

  return { ...results, remaining, done: remaining === 0 };
}

/** Ek image: download -> S3 -> DB update */
async function migrateOne(item) {
  // Beech me kisi aur ne migrate kar diya ho to dobara mat karo
  const current = await currentValue(item);
  if (current && isMigrated(current)) {
    await markDone(item, current, 'pehle se migrated');
    return current;
  }

  const sourceUrl = resolveUrl(item);
  const buffer = await download(sourceUrl);

  const uploaded = await storage.upload(buffer.data, {
    folder: item.folder || 'legacy',
    filename: path.basename(new URL(sourceUrl).pathname) || 'image.jpg',
    contentType: buffer.contentType,
  });

  await updateRecord(item, uploaded.url);
  await markDone(item, uploaded.url);

  return uploaded.url;
}

async function download(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 25 * 1024 * 1024,
    // Purani site pe kuch images pe SSL/redirect issue ho sakta hai
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 300,
    headers: { 'User-Agent': 'oncohealthmart-media-migration/1.0' },
  });

  const contentType = res.headers['content-type'] || '';
  // 404 page HTML aa gaya to usko image samajh ke S3 pe mat daalo
  if (contentType.includes('text/html')) {
    throw new Error('Source ne image ki jagah HTML bheja (404 page?)');
  }
  if (!res.data || res.data.length < 100) {
    throw new Error('File khaali ya bahut chhoti hai');
  }

  return { data: Buffer.from(res.data), contentType };
}

async function currentValue(item) {
  const [[row]] = await db.query(
    `SELECT \`${item.column_name}\` AS val FROM \`${item.source_table}\`
     WHERE \`${item.pk_column}\` = ?`,
    [item.record_id]
  );
  if (!row) return null;

  if (isJsonItem(item)) {
    return parseJson(row.val, [])[item.json_index] || null;
  }
  return row.val;
}

/** DB me nayi URL daalo — JSON column me sirf wahi index badlo */
/** -1 matlab normal column, 0+ matlab JSON array ka element */
function isJsonItem(item) {
  return item.json_index !== null && item.json_index !== undefined && item.json_index >= 0;
}

async function updateRecord(item, newUrl) {
  if (isJsonItem(item)) {
    const [[row]] = await db.query(
      `SELECT \`${item.column_name}\` AS val FROM \`${item.source_table}\`
       WHERE \`${item.pk_column}\` = ?`,
      [item.record_id]
    );
    const arr = parseJson(row?.val, []);
    arr[item.json_index] = newUrl;

    await db.query(
      `UPDATE \`${item.source_table}\` SET \`${item.column_name}\` = ?
       WHERE \`${item.pk_column}\` = ?`,
      [JSON.stringify(arr), item.record_id]
    );
    return;
  }

  await db.query(
    `UPDATE \`${item.source_table}\` SET \`${item.column_name}\` = ?
     WHERE \`${item.pk_column}\` = ?`,
    [newUrl, item.record_id]
  );
}

async function markDone(item, newValue, note) {
  await db.query(
    `UPDATE media_migration_items
     SET status = 'done', new_value = ?, error = ?, attempts = attempts + 1, processed_at = NOW()
     WHERE id = ?`,
    [newValue, note || null, item.id]
  );
}

async function pendingCount(includeFailed = false, tables) {
  const statuses = includeFailed ? "('pending','failed')" : "('pending')";
  let sql = `SELECT COUNT(*) AS c FROM media_migration_items WHERE status IN ${statuses}`;
  const params = [];

  if (tables?.length) {
    sql += ` AND source_table IN (${tables.map(() => '?').join(',')})`;
    params.push(...tables);
  }

  const [[row]] = await db.query(sql, params);
  return row.c;
}

/**
 * Migrate karne se pehle dikhane ke liye — pending images ka sample.
 *
 * source_url public site ki hai, isliye browser seedha `<img>` me load kar
 * leta hai. Isse admin dekh sakta hai ki jo migrate hone wali hai wo sahi
 * image hai ya 404/placeholder.
 */
async function preview({ tables, limit = 24, offset = 0 } = {}) {
  const params = [];
  let tableFilter = '';
  if (tables?.length) {
    tableFilter = ` AND source_table IN (${tables.map(() => '?').join(',')})`;
    params.push(...tables);
  }

  const [rows] = await db.query(
    `SELECT id, source_table, record_id, column_name, json_index, source_url, old_value
     FROM media_migration_items
     WHERE status = 'pending'${tableFilter}
     ORDER BY id ASC LIMIT ? OFFSET ?`,
    [...params, Math.min(parseInt(limit, 10) || 24, 100), parseInt(offset, 10) || 0]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM media_migration_items
     WHERE status = 'pending'${tableFilter}`,
    params
  );

  // URL yahan dobara banate hain, DB me padi hui pe bharosa nahi karte —
  // LEGACY_MEDIA_PATH badla ho to purani queued rows me galat URL padi hogi
  return {
    rows: rows.map((r) => ({ ...r, source_url: resolveUrl(r) })),
    total,
  };
}

/**
 * Item ka asli source URL.
 *
 * `source_url` column scan ke waqt bhara jaata hai. Agar uske baad
 * LEGACY_MEDIA_BASE_URL ya LEGACY_MEDIA_PATH badla ho, to wo stale ho jaata
 * hai — isliye har baar `old_value` se fresh banate hain. Stored column
 * sirf audit ke liye reh jaata hai.
 */
function resolveUrl(item) {
  return toSourceUrl(item.old_value) || item.source_url;
}

/**
 * Purani queued rows ka source_url current config se theek kar do.
 * Runtime pe to resolveUrl already sambhal leta hai, ye sirf DB ko
 * consistent rakhne ke liye hai.
 */
async function repairSourceUrls({ tables } = {}) {
  const params = [];
  let tableFilter = '';
  if (tables?.length) {
    tableFilter = ` AND source_table IN (${tables.map(() => '?').join(',')})`;
    params.push(...tables);
  }

  const [rows] = await db.query(
    `SELECT id, old_value, source_url FROM media_migration_items
     WHERE status IN ('pending','failed')${tableFilter}`,
    params
  );

  let fixed = 0;
  for (const row of rows) {
    const correct = toSourceUrl(row.old_value);
    if (correct && correct !== row.source_url) {
      await db.query(`UPDATE media_migration_items SET source_url = ? WHERE id = ?`,
        [correct, row.id]);
      fixed += 1;
    }
  }
  return { checked: rows.length, fixed };
}

// ---------------------------------------------------------------------------
// Status / control
// ---------------------------------------------------------------------------

async function status() {
  const [byStatus] = await db.query(
    `SELECT status, COUNT(*) AS count FROM media_migration_items GROUP BY status`
  );
  const [byTable] = await db.query(
    `SELECT source_table,
            SUM(status = 'pending') AS pending,
            SUM(status = 'done')    AS done,
            SUM(status = 'failed')  AS failed
     FROM media_migration_items GROUP BY source_table ORDER BY source_table`
  );
  const [[totals]] = await db.query(
    `SELECT COUNT(*) AS total,
            SUM(status = 'done') AS done,
            SUM(status = 'failed') AS failed,
            SUM(status = 'pending') AS pending
     FROM media_migration_items`
  );

  const progress = totals.total
    ? Number(((totals.done / totals.total) * 100).toFixed(1)) : 0;

  return {
    ...totals,
    progress,
    byStatus,
    byTable,
    storage: storage.isS3Enabled() ? 's3' : 'local',
    legacy_base: legacyBase(),
  };
}

async function failedItems({ limit = 50, offset = 0 } = {}) {
  const [rows] = await db.query(
    `SELECT * FROM media_migration_items WHERE status = 'failed'
     ORDER BY id ASC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM media_migration_items WHERE status = 'failed'`
  );
  return { rows, total };
}

/** Failed items ko wapas pending karo — retry ke liye */
async function resetFailed() {
  const [res] = await db.query(
    `UPDATE media_migration_items SET status = 'pending', error = NULL WHERE status = 'failed'`
  );
  return { reset: res.affectedRows };
}

/** Sab clear — dobara scan karne se pehle */
async function clearQueue() {
  const [res] = await db.query(`DELETE FROM media_migration_items`);
  return { cleared: res.affectedRows };
}

module.exports = {
  scan, runBatch, preview, status, failedItems, resetFailed, clearQueue,
  repairSourceUrls, resolveUrl, pendingCount, BATCH_LIMIT,
};