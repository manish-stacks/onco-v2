const productModel = require('../../models/product.model');
const inventoryModel = require('../../models/inventory.model');
const adminModel = require('../../models/admin.model');
const cache = require('../../utils/cache');
const { fieldsToUrls } = require('../../middleware/upload');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination, getSort, toCsv } = require('../../utils/helpers');
const { INVENTORY_CHANGE_TYPE } = require('../../config/constants');

const IMAGE_FIELDS = ['image_1', 'image_2', 'image_3', 'image_4', 'image_5'];

/** Push multipart image fields to S3 and merge them into the payload */
async function mergeImages(body, files) {
  const data = { ...body };
  Object.assign(data, await fieldsToUrls(files, 'products', IMAGE_FIELDS));

  // categories may arrive as a JSON string from form-data
  if (typeof data.categories === 'string') {
    try { data.categories = JSON.parse(data.categories); } catch { data.categories = []; }
  }
  return data;
}

/** GET /admin/products */
const list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const sort = getSort(req.query, productModel.SORTABLE, 'product_id');

  const { rows, total } = await productModel.list({
    status: req.query.status,
    stock: req.query.stock,
    category_id: req.query.category_id,
    brand_id: req.query.brand_id,
    is_featured: req.query.is_featured,
    deal_of_the_day: req.query.deal_of_the_day,
    top_selling: req.query.top_selling,
    latest_product: req.query.latest_product,
    has_flag: req.query.has_flag,
    no_brand: req.query.no_brand,
    search: req.query.search,
    min_price: req.query.min_price,
    max_price: req.query.max_price,
    low_stock: req.query.low_stock,
    out_of_stock: req.query.out_of_stock,
    expiring_soon: req.query.expiring_soon,
    prescription_required: req.query.prescription_required,
  }, { limit, offset }, sort);

  return paginated(res, rows, total, page, limit);
});

/** GET /admin/products/flag-counts — how many products carry each flag */
const flagCounts = asyncHandler(async (req, res) => ok(res, await productModel.flagCounts()));

/**
 * PATCH /admin/products/:productId/flag
 * body: { flag: 'top_selling' }
 * Toggles it — on/off in one click from the list page.
 */
const toggleFlag = asyncHandler(async (req, res) => {
  const value = await productModel.toggleFlag(req.params.productId, req.body.flag);
  await cache.invalidate.products();
  return ok(res, { flag: req.body.flag, value }, value ? 'Flag applied' : 'Flag removed');
});

/**
 * PATCH /admin/products/bulk-flags
 * body: { product_ids: [1,2,3], flags: { top_selling: true, deal_of_the_day: false } }
 */
const bulkFlags = asyncHandler(async (req, res) => {
  const { product_ids: productIds, flags } = req.body;

  if (!Array.isArray(productIds) || !productIds.length) {
    return fail(res, 'product_ids array is required', 422);
  }
  if (!flags || !Object.keys(flags).length) {
    return fail(res, 'A flags object is required', 422);
  }

  const invalid = Object.keys(flags).filter((f) => !productModel.FLAGS.includes(f));
  if (invalid.length) {
    return fail(res, `These flags are not valid: ${invalid.join(', ')}`, 422);
  }

  const updated = await productModel.bulkSetFlags(productIds, flags);
  await cache.invalidate.products();

  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'bulk_flags', module: 'products',
    description: `${updated} products · ${JSON.stringify(flags)}`, ip_address: req.ip,
  });

  return ok(res, { updated }, `${updated} products updated`);
});

/** PATCH /admin/products/bulk-brand — set the selected products to one brand */
const bulkBrand = asyncHandler(async (req, res) => {
  const { product_ids: productIds, brand_id: brandId } = req.body;
  if (!Array.isArray(productIds) || !productIds.length) {
    return fail(res, 'product_ids array is required', 422);
  }

  const db = require('../../config/db');
  const [result] = await db.query(
    `UPDATE products SET brand_id = ? WHERE product_id IN (${productIds.map(() => '?').join(',')})`,
    [brandId || null, ...productIds]
  );
  await db.query(
    `UPDATE brands b SET product_count = (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id)`
  );
  await cache.invalidate.products();

  return ok(res, { updated: result.affectedRows }, `The brand was set on ${result.affectedRows} products`);
});

/** GET /admin/products/:productId */
const detail = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.productId);
  if (!product) return fail(res, 'Product not found', 404);

  const { rows: movements } = await inventoryModel.listMovements(
    { product_id: req.params.productId }, { limit: 20, offset: 0 }
  );
  return ok(res, { ...product, recent_movements: movements });
});

/** POST /admin/products */
const create = asyncHandler(async (req, res) => {
  const data = await mergeImages(req.body, req.files);
  const { categories, stock_quantity, ...productData } = data;

  if (!productData.product_name) return fail(res, 'product_name is required', 422);

  productData.slug = productData.slug
    ? await productModel.generateUniqueSlug(productData.slug)
    : await productModel.generateUniqueSlug(productData.product_name);

  const openingStock = parseInt(stock_quantity, 10) || 0;
  productData.stock_quantity = openingStock;
  productData.stock = openingStock > 0 ? 'In Stock' : 'Out of Stock';

  const productId = await productModel.create(productData);

  if (Array.isArray(categories) && categories.length) {
    await productModel.setCategories(productId, categories);
  }

  // record the opening stock in the inventory log
  if (openingStock > 0) {
    const db = require('../../config/db');
    await inventoryModel.logMovement(db, {
      productId,
      changeType: INVENTORY_CHANGE_TYPE.INITIAL,
      quantityChange: openingStock,
      quantityBefore: 0,
      quantityAfter: openingStock,
      referenceType: 'manual',
      changedBy: req.admin.admin_username,
      note: 'Opening stock',
    });
  }

  await cache.invalidate.products();
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'create', module: 'products', record_id: productId,
    description: productData.product_name, ip_address: req.ip,
  });

  return created(res, await productModel.findById(productId), 'Product created');
});

/** PUT /admin/products/:productId */
const update = asyncHandler(async (req, res) => {
  const productId = req.params.productId;
  const existing = await productModel.findById(productId);
  if (!existing) return fail(res, 'Product not found', 404);

  const data = await mergeImages(req.body, req.files);
  const { categories, stock_quantity, ...productData } = data;

  if (productData.slug && productData.slug !== existing.slug) {
    productData.slug = await productModel.generateUniqueSlug(productData.slug, productId);
  }

  // do not change stock here — use the inventory endpoint (for the audit trail)
  await productModel.update(productId, productData);

  if (Array.isArray(categories)) {
    await productModel.setCategories(productId, categories);
  }

  await cache.invalidate.products();
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'update', module: 'products', record_id: productId,
    description: existing.product_name, ip_address: req.ip,
  });

  return ok(res, await productModel.findById(productId), 'Product updated');
});

/** PATCH /admin/products/:productId/status */
const setStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Active', 'Inactive'].includes(status)) return fail(res, "status must be 'Active' or 'Inactive'", 422);

  await productModel.setStatus(req.params.productId, status);
  await cache.invalidate.products();
  return ok(res, null, `Product ${status}`);
});

/** PATCH /admin/products/bulk-status */
const bulkStatus = asyncHandler(async (req, res) => {
  const { product_ids, status } = req.body;
  if (!Array.isArray(product_ids) || !product_ids.length) return fail(res, 'product_ids array is required', 422);
  if (!['Active', 'Inactive'].includes(status)) return fail(res, "status must be 'Active' or 'Inactive'", 422);

  await productModel.bulkSetStatus(product_ids, status);
  await cache.invalidate.products();
  return ok(res, { updated: product_ids.length }, `${product_ids.length} products ${status} kar diye`);
});

/** DELETE /admin/products/:productId */
const remove = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.productId);
  if (!product) return fail(res, 'Product not found', 404);

  await productModel.remove(req.params.productId);
  await cache.invalidate.products();
  await adminModel.logActivity({
    admin_id: req.admin.admin_id, admin_username: req.admin.admin_username,
    action: 'delete', module: 'products', record_id: req.params.productId,
    description: product.product_name, ip_address: req.ip,
  });

  return ok(res, null, 'Product deleted');
});

/** GET /admin/products/export — CSV */
const exportCsv = asyncHandler(async (req, res) => {
  const { rows } = await productModel.list({
    status: req.query.status,
    category_id: req.query.category_id,
    search: req.query.search,
  }, { limit: 5000, offset: 0 });

  const csv = toCsv(rows, [
    'product_id', 'product_name', 'sku', 'hsn_code', 'company_name', 'category',
    'product_mrp', 'product_sp', 'product_gst', 'stock_quantity', 'low_stock_alert',
    'batch_number', 'expiry_date', 'total_sold', 'presciption_required', 'status',
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="products-${Date.now()}.csv"`);
  return res.send(csv);
});

module.exports = {
  list, detail, create, update, setStatus, bulkStatus, remove, exportCsv,
  flagCounts, toggleFlag, bulkFlags, bulkBrand,
};