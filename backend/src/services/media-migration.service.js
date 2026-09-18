const axios = require('axios');
const path = require('path');
const db = require('../config/db');
const storage = require('./storage.service');
const cache = require('../utils/cache');
const { parseJson } = require('../utils/helpers');
const {
  MEDIA_MAP, toSourceUrl, isMigrated, legacyBase, legacyPathForTable,
} = require('../config/media');

/**
 * Purani site (oncohealthmart.com) pe padi images ko S3 pe le jaana.
 *
 * Do phase me:
 *   1. SCAN  — DB scan karke `media_migration_items` me kaam ki list banao
 *   2. RUN   — process in batches (50/100): download -> S3 -> DB update
 *
 * Batched because 10,000+ images cannot be done in one request — the request
 * it would time out, and a mid-way failure would leave no trace of how far it got.
 * Every item has its own status, so each run continues from where it stopped.
 */

const BATCH_LIMIT = 200; // never more than this in one request, no matter what is asked

// ---------------------------------------------------------------------------
// SCAN
// ---------------------------------------------------------------------------

/**
 * Scan the DB and build the list of pending items.
 * Re-running it will not duplicate items that are already queued.
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

        // JSON array column (prescriptions.images) — each element is a separate item
        // json_index: -1 = normal column, 0+ = JSON array ka index.
        // We avoid NULL because MySQL's UNIQUE index does not treat NULL
        // as a duplicate — the dedupe breaks.
        const values = map.json
          ? parseJson(raw, []).map((v, i) => ({ value: v, index: i }))
          : [{ value: raw, index: -1 }];

        for (const { value, index } of values) {
          if (!value) continue;
          found += 1;

          if (isMigrated(value)) { skipped += 1; continue; }

          const sourceUrl = toSourceUrl(value, map.legacyPath);
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
      already_migrated: skipped,  // already on S3
    });
  }

  const [[{ pending }]] = await db.query(
    `SELECT COUNT(*) AS pending FROM media_migration_items WHERE status = 'pending'`
  );

  return { tables: summary, pending };
}

/** Avoid duplicates — do not queue the same (table, record, column, index) twice */
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
 * Process the next batch.
 * @param {object} opts { limit, retryFailed, dryRun }
 */
async function runBatch({ limit = 50, retryFailed = false, dryRun = false, tables } = {}) {
  const size = Math.min(Math.max(parseInt(limit, 10) || 50, 1), BATCH_LIMIT);

  const statuses = retryFailed ? ['pending', 'failed'] : ['pending'];
  const params = [...statuses];

  // Only the selected tables — migrate exactly what the admin picked
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

  // If images changed, the product/category cache is still serving the old URLs
  if (results.succeeded > 0) {
    await cache.invalidate.all();
  }

  const remaining = await pendingCount(retryFailed, tables);

  return { ...results, remaining, done: remaining === 0 };
}

/** Ek image: download -> S3 -> DB update */
async function migrateOne(item) {
  // If someone else migrated it in the meantime, do not do it again
  const current = await currentValue(item);
  if (current && isMigrated(current)) {
    await markDone(item, current, 'already migrated');
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
    // Some images on the old site may have SSL/redirect issues
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 300,
    headers: { 'User-Agent': 'oncohealthmart-media-migration/1.0' },
  });

  const contentType = res.headers['content-type'] || '';
  // if a 404 page HTML comes back, do not treat it as an image and push it to S3
  if (contentType.includes('text/html')) {
    throw new Error('The source returned HTML instead of an image (404 page?)');
  }
  if (!res.data || res.data.length < 100) {
    throw new Error('The file is empty or too small');
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

/** Write the new URL into the DB — in a JSON column, change only that index */
/** -1 means a normal column, 0+ means an element of a JSON array */
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
 * Preview before migrating — a sample of the pending images.
 *
 * the source_url belongs to the public site, so the browser can load it directly in an `<img>`
 * This lets the admin verify that what is about to be migrated is correct
 * whether the image exists or is a 404/placeholder.
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

  // We rebuild the URL here rather than trusting what is stored in the DB —
  // If LEGACY_MEDIA_PATH changed, the old queued rows hold the wrong URL
  return {
    rows: rows.map((r) => ({ ...r, source_url: resolveUrl(r) })),
    total,
  };
}

/**
 * Item ka asli source URL.
 *
 * The `source_url` column is filled during the scan. If afterwards
 * If LEGACY_MEDIA_BASE_URL or LEGACY_MEDIA_PATH changed, it goes stale
 * so we rebuild it from `old_value` every time. A stored column
 * remains only for auditing.
 */
function resolveUrl(item) {
  return toSourceUrl(item.old_value, legacyPathForTable(item.source_table)) || item.source_url;
}

/**
 * Purani queued rows ka source_url current config se theek kar do.
 * At runtime resolveUrl already handles it; this only keeps the DB
 * exists to keep it consistent.
 */
async function repairSourceUrls({ tables } = {}) {
  const params = [];
  let tableFilter = '';
  if (tables?.length) {
    tableFilter = ` AND source_table IN (${tables.map(() => '?').join(',')})`;
    params.push(...tables);
  }

  const [rows] = await db.query(
    `SELECT id, source_table, old_value, source_url FROM media_migration_items
     WHERE status IN ('pending','failed')${tableFilter}`,
    params
  );

  let fixed = 0;
  for (const row of rows) {
    const correct = toSourceUrl(row.old_value, legacyPathForTable(row.source_table));
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

/** Move failed items back to pending — for a retry */
async function resetFailed() {
  const [res] = await db.query(
    `UPDATE media_migration_items SET status = 'pending', error = NULL WHERE status = 'failed'`
  );
  return { reset: res.affectedRows };
}

/** Clear everything — before scanning again */
async function clearQueue() {
  const [res] = await db.query(`DELETE FROM media_migration_items`);
  return { cleared: res.affectedRows };
}

module.exports = {
  scan, runBatch, preview, status, failedItems, resetFailed, clearQueue,
  repairSourceUrls, resolveUrl, pendingCount, BATCH_LIMIT,
};