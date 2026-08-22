const redis = require('../config/redis');
const { CACHE_TTL } = require('../config/constants');

/**
 * The app must not crash if Redis breaks — every function
 * swallows the error and returns data directly from the DB.
 */

/** Cache-aside: check redis first, otherwise run fetchFn and store the result */
async function getOrSet(key, ttlSeconds, fetchFn) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached);
  } catch (err) {
    console.error('[cache] read fail', key, err.message);
  }

  const fresh = await fetchFn();

  try {
    await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds || CACHE_TTL.MEDIUM);
  } catch (err) {
    console.error('[cache] write fail', key, err.message);
  }
  return fresh;
}

async function get(key) {
  try {
    const v = await redis.get(key);
    return v === null ? null : JSON.parse(v);
  } catch { return null; }
}

async function set(key, value, ttlSeconds = CACHE_TTL.MEDIUM) {
  try { await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds); } catch (err) {
    console.error('[cache] set fail', key, err.message);
  }
}

async function del(...keys) {
  if (!keys.length) return;
  try { await redis.del(...keys); } catch (err) {
    console.error('[cache] del fail', err.message);
  }
}

/** Delete every prefix* key via SCAN — does not use KEYS (prod safe) */
async function delByPrefix(prefix) {
  try {
    const fullPrefix = `${redis.options.keyPrefix || ''}${prefix}`;
    const stream = redis.scanStream({ match: `${fullPrefix}*`, count: 200 });
    const batch = [];
    for await (const keys of stream) {
      keys.forEach((k) => batch.push(k.replace(redis.options.keyPrefix || '', '')));
    }
    if (batch.length) {
      const pipeline = redis.pipeline();
      batch.forEach((k) => pipeline.del(k));
      await pipeline.exec();
    }
  } catch (err) {
    console.error('[cache] delByPrefix fail', prefix, err.message);
  }
}

/** When a product/category changes, clear every list cache that depends on it */
const invalidate = {
  products: () => Promise.all([delByPrefix('products:'), delByPrefix('home:')]),
  categories: () => Promise.all([delByPrefix('categories:'), delByPrefix('products:'), delByPrefix('home:')]),
  brands: () => Promise.all([delByPrefix('brands:'), delByPrefix('home:')]),
  coupons: () => delByPrefix('coupons:'),
  banners: () => Promise.all([delByPrefix('banners:'), delByPrefix('home:')]),
  settings: () => Promise.all([delByPrefix('settings:'), delByPrefix('home:')]),
  orders: () => Promise.all([delByPrefix('admin:dashboard'), delByPrefix('admin:orders:'), delByPrefix('reports:')]),
  cms: () => delByPrefix('cms:'),
  all: () => delByPrefix(''),
};

/** Cache key banane ka consistent tarika — object ko sorted string me */
function buildKey(namespace, params = {}) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return sorted ? `${namespace}:${sorted}` : namespace;
}

module.exports = { getOrSet, get, set, del, delByPrefix, invalidate, buildKey, TTL: CACHE_TTL };
