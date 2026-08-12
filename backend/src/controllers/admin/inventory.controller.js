const inventoryModel = require('../../models/inventory.model');
const adminModel = require('../../models/admin.model');
const cache = require('../../utils/cache');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination, toCsv } = require('../../utils/helpers');
const { INVENTORY_CHANGE_TYPE } = require('../../config/constants');
const events = require('../../services/events.service');

/** GET /admin/inventory/summary — dashboard cards */
const summary = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('inventory:summary', cache.TTL.SHORT, () => inventoryModel.summary());
  return ok(res, data);
});

/** GET /admin/inventory/low-stock */
const lowStock = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  return ok(res, await inventoryModel.lowStockProducts(limit));
});

/** GET /admin/inventory/out-of-stock */
const outOfStock = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  return ok(res, await inventoryModel.outOfStockProducts(limit));
});

/** GET /admin/inventory/expiring?days=90 */
const expiring = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days, 10) || 90;
  const limit = parseInt(req.query.limit, 10) || 50;
  return ok(res, await inventoryModel.expiringProducts(days, limit));
});

/** GET /admin/inventory/movements — poora stock ledger */
const movements = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 50, 200);
  const { rows, total } = await inventoryModel.listMovements({
    product_id: req.query.product_id,
    change_type: req.query.change_type,
    reference_type: req.query.reference_type,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
  }, { limit, offset });

  return paginated(res, rows, total, page, limit);
});

/**
 * PATCH /admin/inventory/:productId
 * Exact stock set karo (physical count ke baad). Difference log ho jaata hai.
 */
const adjustStock = asyncHandler(async (req, res) => {
  const { stock_quantity, note, change_type } = req.body;

  if (stock_quantity === undefined || stock_quantity === null) {
    return fail(res, 'stock_quantity chahiye', 422);
  }
  const validTypes = Object.values(INVENTORY_CHANGE_TYPE);
  if (change_type && !validTypes.includes(change_type)) {
    return fail(res, `change_type in me se ek: ${validTypes.join(', ')}`, 422);
  }

  const result = await inventoryModel.setStock(req.params.productId, stock_quantity, {
    changedBy: req.admin.admin_username,
    note,
    changeType: change_type,
  });

  await cache.invalidate.products();
  await cache.del('inventory:summary');
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'stock_adjust', module: 'inventory', record_id: req.params.productId,
    description: `${result.before} -> ${result.after}${note ? ` (${note})` : ''}`,
    ip_address: req.ip,
  });

  events.emit('stock.changed', {
    product_id: Number(req.params.productId),
    before: result.before, after: result.after,
    changed_by: req.admin.admin_username,
  }, 'inventory.view');

  return ok(res, result, `Stock ${result.before} se ${result.after} kar diya`);
});

/**
 * POST /admin/inventory/:productId/add — naya stock aaya (purchase)
 * Adjust se alag: ye quantity ADD karta hai, set nahi karta.
 */
const addStock = asyncHandler(async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  if (!quantity || quantity < 1) return fail(res, 'quantity 1 se zyada honi chahiye', 422);

  const db = require('../../config/db');
  const after = await db.withTransaction(async (conn) => inventoryModel.incrementStock(conn, {
    productId: req.params.productId,
    quantity,
    changeType: req.body.change_type || INVENTORY_CHANGE_TYPE.PURCHASE,
    referenceType: 'manual',
    changedBy: req.admin.admin_username,
    note: req.body.note || 'Stock aaya',
  }));

  await cache.invalidate.products();
  await cache.del('inventory:summary');

  return ok(res, { stock_quantity: after }, `${quantity} units add ho gaye`);
});

/**
 * POST /admin/inventory/:productId/remove — damage / expiry me stock nikaalo
 */
const removeStock = asyncHandler(async (req, res) => {
  const quantity = parseInt(req.body.quantity, 10);
  if (!quantity || quantity < 1) return fail(res, 'quantity 1 se zyada honi chahiye', 422);

  const changeType = req.body.change_type || INVENTORY_CHANGE_TYPE.DAMAGE;

  const db = require('../../config/db');
  const after = await db.withTransaction(async (conn) => {
    const [[product]] = await conn.query(
      `SELECT stock_quantity FROM products WHERE product_id = ? FOR UPDATE`, [req.params.productId]
    );
    if (!product) throw Object.assign(new Error('Product nahi mila'), { status: 404 });

    const before = product.stock_quantity;
    const newQty = Math.max(0, before - quantity);

    await conn.query(
      `UPDATE products SET stock_quantity = ?, stock = ? WHERE product_id = ?`,
      [newQty, newQty > 0 ? 'In Stock' : 'Out of Stock', req.params.productId]
    );
    await inventoryModel.logMovement(conn, {
      productId: req.params.productId,
      changeType,
      quantityChange: -(before - newQty),
      quantityBefore: before,
      quantityAfter: newQty,
      referenceType: 'manual',
      changedBy: req.admin.admin_username,
      note: req.body.note || `${changeType} me nikala`,
    });
    return newQty;
  });

  await cache.invalidate.products();
  await cache.del('inventory:summary');

  return ok(res, { stock_quantity: after }, `${quantity} units nikaal diye`);
});

/** POST /admin/inventory/bulk — CSV import / stock taking */
const bulkUpdate = asyncHandler(async (req, res) => {
  const updates = req.body.updates;
  if (!Array.isArray(updates) || !updates.length) {
    return fail(res, 'updates array chahiye: [{ product_id, stock_quantity, note }]', 422);
  }

  const results = await inventoryModel.bulkSetStock(updates, req.admin.admin_username);

  await cache.invalidate.products();
  await cache.del('inventory:summary');
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'bulk_stock_update', module: 'inventory',
    description: `${updates.length} products`, ip_address: req.ip,
  });

  return ok(res, {
    total: results.length,
    updated: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    results,
  }, 'Bulk update ho gaya');
});

/** GET /admin/inventory/export */
const exportCsv = asyncHandler(async (req, res) => {
  const { rows } = await inventoryModel.listMovements({
    product_id: req.query.product_id,
    change_type: req.query.change_type,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
  }, { limit: 10000, offset: 0 });

  const csv = toCsv(rows, [
    'log_id', 'created_at', 'product_id', 'product_name', 'sku', 'change_type',
    'quantity_change', 'quantity_before', 'quantity_after', 'reference_type',
    'reference_id', 'changed_by', 'note',
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventory-${Date.now()}.csv"`);
  return res.send(csv);
});

module.exports = {
  summary, lowStock, outOfStock, expiring, movements,
  adjustStock, addStock, removeStock, bulkUpdate, exportCsv,
};
