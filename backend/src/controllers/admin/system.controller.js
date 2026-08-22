const redis = require('../../config/redis');
const cache = require('../../utils/cache');
const health = require('../../services/health.service');
const mediaMigration = require('../../services/media-migration.service');
const storage = require('../../services/storage.service');
const mediaRoutes = require('../../routes/media.routes');
const adminModel = require('../../models/admin.model');
const { MEDIA_MAP } = require('../../config/media');
const { ok, fail, asyncHandler } = require('../../utils/response');

// ---------------------------------------------------------------------------
// HEALTH
// ---------------------------------------------------------------------------

/** GET /admin/system/health?deep=true */
const getHealth = asyncHandler(async (req, res) => {
  const data = await health.fullHealth({ deep: req.query.deep === 'true' });
  return ok(res, data);
});

// ---------------------------------------------------------------------------
// CACHE
// ---------------------------------------------------------------------------

/** GET /admin/system/cache — how much cache is stored */
const cacheStats = asyncHandler(async (req, res) => {
  let redisInfo = { ok: false };
  try {
    const info = await redis.info('memory');
    const used = info.match(/used_memory_human:(\S+)/);
    const peak = info.match(/used_memory_peak_human:(\S+)/);

    // Only count keys with our prefix — the DB may be shared
    const prefix = redis.options.keyPrefix || '';
    let keys = 0;
    const byNamespace = {};

    const stream = redis.scanStream({ match: `${prefix}*`, count: 500 });
    // eslint-disable-next-line no-restricted-syntax
    for await (const batch of stream) {
      keys += batch.length;
      batch.forEach((k) => {
        const bare = k.replace(prefix, '');
        const ns = bare.split(':')[0] || 'other';
        byNamespace[ns] = (byNamespace[ns] || 0) + 1;
      });
    }

    redisInfo = {
      ok: true,
      keys,
      used_memory: used?.[1] || null,
      peak_memory: peak?.[1] || null,
      prefix,
      by_namespace: Object.entries(byNamespace)
        .map(([namespace, count]) => ({ namespace, count }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (err) {
    redisInfo = { ok: false, error: err.message };
  }

  return ok(res, {
    redis: redisInfo,
    media_cache: mediaRoutes.cacheStats(),
  });
});

/**
 * POST /admin/system/cache/clear
 * body: { scope: 'all' | 'redis' | 'media' | 'products' | 'orders' | ... }
 *
 * Default 'all' — Redis ke saare ohm:* keys + media disk cache dono.
 */
const clearCache = asyncHandler(async (req, res) => {
  const scope = req.body.scope || 'all';
  const result = {};

  const SCOPES = {
    products: cache.invalidate.products,
    categories: cache.invalidate.categories,
    brands: cache.invalidate.brands,
    coupons: cache.invalidate.coupons,
    banners: cache.invalidate.banners,
    settings: cache.invalidate.settings,
    orders: cache.invalidate.orders,
    cms: cache.invalidate.cms,
  };

  if (scope === 'media') {
    result.media = mediaRoutes.clearCache();
  } else if (scope === 'redis' || scope === 'all') {
    // All prefixed keys — other apps' data is untouched,
    // so a prefix scan instead of FLUSHDB
    await cache.invalidate.all();
    result.redis = { cleared: true };

    if (scope === 'all') {
      result.media = mediaRoutes.clearCache();
    }
  } else if (SCOPES[scope]) {
    await SCOPES[scope]();
    result[scope] = { cleared: true };
  } else {
    return fail(res, `Unknown scope: ${scope}`, 422);
  }

  await adminModel.logActivity({
    admin_id: req.admin.admin_id,
    admin_username: req.admin.admin_username,
    action: 'cache_clear',
    module: 'system',
    description: `scope: ${scope}`,
    ip_address: req.ip,
  });

  return ok(res, result, scope === 'all'
    ? 'The entire cache was cleared'
    : `${scope} cache cleared`);
});

// ---------------------------------------------------------------------------
// MEDIA MIGRATION
// ---------------------------------------------------------------------------

/** Table list from the query or body — accepts either the string "a,b" or an array */
function normalizeTables(value) {
  if (!value) return null;
  const arr = Array.isArray(value) ? value : String(value).split(',');
  const clean = arr.map((t) => String(t).trim()).filter(Boolean);

  // Only tables present in MEDIA_MAP — no arbitrary table name gets through
  const allowed = new Set(MEDIA_MAP.map((m) => m.table));
  const valid = clean.filter((t) => allowed.has(t));
  return valid.length ? valid : null;
}

/**
 * GET /admin/system/media/preview?tables=products,categories&limit=24
 *
 * Preview before migrating — which images are about to move.
 */
const previewMedia = asyncHandler(async (req, res) => {
  const data = await mediaMigration.preview({
    tables: normalizeTables(req.query.tables),
    limit: req.query.limit,
    offset: req.query.offset,
  });
  return ok(res, data);
});

/** GET /admin/system/media/status */
const mediaStatus = asyncHandler(async (req, res) => {
  const [status, cacheInfo] = await Promise.all([
    mediaMigration.status(),
    Promise.resolve(mediaRoutes.cacheStats()),
  ]);

  return ok(res, {
    ...status,
    storage_configured: storage.isS3Enabled(),
    storage_config: storage.isS3Enabled() ? {
      bucket: storage.config().bucket,
      region: storage.config().region,
      cdn: storage.config().cdn || null,
      serve_mode: process.env.MEDIA_SERVE_MODE || 'direct',
    } : null,
    media_cache: cacheInfo,
    tables: MEDIA_MAP.map((m) => ({ table: m.table, columns: m.columns, json: !!m.json })),
    batch_limit: mediaMigration.BATCH_LIMIT,
  });
});

/**
 * POST /admin/system/media/scan
 * Scans the DB and builds a work list. It takes a little time to run
 * (it reads every table) but this is a one-time job.
 */
const scanMedia = asyncHandler(async (req, res) => {
  if (!storage.isS3Enabled()) {
    return fail(res, 'Configure S3 first — set S3_BUCKET and the keys in .env', 409);
  }

  const result = await mediaMigration.scan({ tables: normalizeTables(req.body.tables) });

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'media_scan', module: 'system',
    description: `${result.pending} images queued`, ip_address: req.ip,
  });

  return ok(res, result, `${result.pending} images remaining to migrate`);
});

/**
 * POST /admin/system/media/migrate
 * body: { limit: 50, retry_failed: false }
 *
 * Processes one batch and returns immediately. The admin panel
 * calls this repeatedly until `done` is returned — so each batch's
 * the result keeps updating and the request does not time out.
 */
const migrateMedia = asyncHandler(async (req, res) => {
  if (!storage.isS3Enabled()) {
    return fail(res, 'Configure S3 first', 409);
  }

  const result = await mediaMigration.runBatch({
    limit: req.body.limit || 50,
    retryFailed: req.body.retry_failed === true,
    dryRun: req.body.dry_run === true,
    tables: normalizeTables(req.body.tables),
  });

  return ok(res, result, result.done
    ? 'All images have been migrated'
    : `${result.succeeded} migrate hui, ${result.remaining} baaki`);
});

/** GET /admin/system/media/failed */
const failedMedia = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;
  const data = await mediaMigration.failedItems({ limit, offset });
  return ok(res, data);
});

/**
 * POST /admin/system/media/repair-urls
 * If LEGACY_MEDIA_PATH changed, fix the URLs on the old queued rows.
 */
const repairUrls = asyncHandler(async (req, res) => {
  const result = await mediaMigration.repairSourceUrls({
    tables: normalizeTables(req.body.tables),
  });
  return ok(res, result, `${result.fixed} URLs fixed (${result.checked} checked)`);
});

/** POST /admin/system/media/retry-failed */
const retryFailed = asyncHandler(async (req, res) => {
  const result = await mediaMigration.resetFailed();
  return ok(res, result, `${result.reset} items will be retried`);
});

/** DELETE /admin/system/media/queue */
const clearQueue = asyncHandler(async (req, res) => {
  const result = await mediaMigration.clearQueue();

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'media_queue_clear', module: 'system',
    description: `${result.cleared} items`, ip_address: req.ip,
  });

  return ok(res, result, 'Migration queue cleared');
});

module.exports = {
  getHealth, cacheStats, clearCache,
  mediaStatus, scanMedia, previewMedia, migrateMedia, failedMedia, retryFailed,
  repairUrls, clearQueue,
};