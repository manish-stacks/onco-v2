const categoryModel = require('../../models/category.model');
const couponModel = require('../../models/coupon.model');
const reviewModel = require('../../models/review.model');
const settingsModel = require('../../models/settings.model');
const cache = require('../../utils/cache');
const { storeFile, fieldsToUrls } = require('../../middleware/upload');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

// ---------------------------------------------------------------------------
// CATEGORIES
// ---------------------------------------------------------------------------
const listCategories = asyncHandler(async (req, res) => {
  const {
    status = '',
    parent_id = '',
    search = '',
    page = 1,
    limit = 10,
  } = req.query;

  const currentPage = Math.max(Number(page) || 1, 1);

  const perPage = Math.min(
    Math.max(Number(limit) || 10, 1),
    100
  );

  const offset = (currentPage - 1) * perPage;

  const result = await categoryModel.list(
    {
      status: status.trim(),
      parent_id: parent_id.trim(),
      search: search.trim(),
    },
    {
      limit: perPage,
      offset,
    }
  );

  return paginated(
    res,
    result.rows,
    result.total,
    currentPage,
    perPage
  );
});
const categoryTree = asyncHandler(async (req, res) => {
  return ok(res, await categoryModel.tree(req.query.status || 'Active'));
});

const categoryDetail = asyncHandler(async (req, res) => {
  const cat = await categoryModel.findById(req.params.categoryId);
  if (!cat) return fail(res, 'Category not found', 404);
  return ok(res, cat);
});

const createCategory = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  Object.assign(data, await fieldsToUrls(req.files, 'categories', ['category_image', 'category_banner']));

  const id = await categoryModel.create(data);
  await cache.invalidate.categories();
  return created(res, { category_id: id }, 'Category created');
});

const updateCategory = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  Object.assign(data, await fieldsToUrls(req.files, 'categories', ['category_image', 'category_banner']));

  const updated = await categoryModel.update(req.params.categoryId, data);
  if (!updated) return fail(res, 'No valid field was provided', 422);

  await cache.invalidate.categories();
  return ok(res, null, 'Category updated');
});

const removeCategory = asyncHandler(async (req, res) => {
  await categoryModel.remove(req.params.categoryId);
  await cache.invalidate.categories();
  return ok(res, null, 'Category deleted');
});

// ---------------------------------------------------------------------------
// BRANDS
// ---------------------------------------------------------------------------
const listBrands = asyncHandler(async (req, res) => {
  const {
    title = '',
    status = '',
    page = 1,
    limit = 10,
    is_featured = '',
  } = req.query;

  const currentPage = Math.max(Number(page) || 1, 1);

  const perPage = Math.min(
    Math.max(Number(limit) || 10, 1),
    100
  );

  const result = await settingsModel.listBrands({
    title: title.trim(),
    status: status.trim(),
    page: currentPage,
    limit: perPage,
    is_featured:
      is_featured === ''
        ? ''
        : Number(is_featured),
  });

  console.log('BRAND RESULT:', result);

  return paginated(
    res,
    result.rows,
    result.total,
    currentPage,
    perPage
  );
});
/**
 * POST /admin/brands/:brandId/merge
 * body: { merge_ids: [2, 5] }
 *
 * Galat split hui brands ko jodne ke liye — "Cipla" aur "Cipla Ltd" alag
 * have been created, merge them. Products shift to the target brand,
 * the remaining brands are deleted.
 */
const mergeBrands = asyncHandler(async (req, res) => {
  const db = require('../../config/db');
  const targetId = parseInt(req.params.brandId, 10);
  const mergeIds = (req.body.merge_ids || [])
    .map((i) => parseInt(i, 10))
    .filter((i) => i && i !== targetId);

  if (!mergeIds.length) return fail(res, 'merge_ids is required', 422);

  const [[target]] = await db.query(`SELECT id, title FROM brands WHERE id = ?`, [targetId]);
  if (!target) return fail(res, 'Target brand not found', 404);

  const [moved] = await db.query(
    `UPDATE products SET brand_id = ? WHERE brand_id IN (${mergeIds.map(() => '?').join(',')})`,
    [targetId, ...mergeIds]
  );
  await db.query(
    `DELETE FROM brands WHERE id IN (${mergeIds.map(() => '?').join(',')})`, mergeIds
  );
  await db.query(
    `UPDATE brands b SET product_count = (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id)`
  );

  await cache.invalidate.brands();
  await cache.invalidate.products();

  return ok(res, { moved: moved.affectedRows, merged: mergeIds.length },
    `${mergeIds.length} brands "${target.title}" me mila diye — ${moved.affectedRows} products shift hue`);
});

const createBrand = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image_url = await storeFile(req.file, 'brands');
  const id = await settingsModel.createBrand(data);
  await cache.invalidate.brands();
  return created(res, { id }, 'Brand created');
});

const updateBrand = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image_url = await storeFile(req.file, 'brands');
  await settingsModel.updateBrand(req.params.brandId, data);
  await cache.invalidate.brands();
  return ok(res, null, 'Brand updated');
});

const removeBrand = asyncHandler(async (req, res) => {
  await settingsModel.removeBrand(req.params.brandId);
  await cache.invalidate.brands();
  return ok(res, null, 'Brand deleted');
});

// ---------------------------------------------------------------------------
// COUPONS
// ---------------------------------------------------------------------------
const listCoupons = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await couponModel.list({
    status: req.query.status,
    discount_type: req.query.discount_type,
    expired: req.query.expired,
    search: req.query.search,
  }, { limit, offset });
  return paginated(res, rows, total, page, limit);
});

const couponDetail = asyncHandler(async (req, res) => {
  const coupon = await couponModel.findById(req.params.couponId);
  if (!coupon) return fail(res, 'Coupon not found', 404);
  return ok(res, coupon);
});

const createCoupon = asyncHandler(async (req, res) => {
  if (!req.body.coupon_code) return fail(res, 'coupon_code is required', 422);

  const existing = await couponModel.findByCode(req.body.coupon_code);
  if (existing) return fail(res, 'This coupon code already exists', 409);

  const id = await couponModel.create(req.body);
  await cache.invalidate.coupons();
  return created(res, { coupon_id: id }, 'Coupon created');
});

const updateCoupon = asyncHandler(async (req, res) => {
  await couponModel.update(req.params.couponId, req.body);
  await cache.invalidate.coupons();
  return ok(res, await couponModel.findById(req.params.couponId), 'Coupon updated');
});

const removeCoupon = asyncHandler(async (req, res) => {
  await couponModel.remove(req.params.couponId);
  await cache.invalidate.coupons();
  return ok(res, null, 'Coupon deleted');
});

/** GET /admin/coupons/:couponId/usage — who used it and when */
const couponUsage = asyncHandler(async (req, res) => {
  return ok(res, await couponModel.usageReport(req.params.couponId));
});

// ---------------------------------------------------------------------------
// PRODUCT REVIEWS (moderation)
// ---------------------------------------------------------------------------
const listReviews = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await reviewModel.listAll({
    status: req.query.status,
    product_id: req.query.product_id,
    rating: req.query.rating,
  }, { limit, offset });
  return paginated(res, rows, total, page, limit);
});

const moderateReview = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
    return fail(res, "status must be 'Pending' / 'Approved' / 'Rejected'", 422);
  }
  await reviewModel.setStatus(req.params.reviewId, status);
  await cache.invalidate.products();
  return ok(res, null, `Review ${status}`);
});

const removeReview = asyncHandler(async (req, res) => {
  await reviewModel.remove(req.params.reviewId);
  await cache.invalidate.products();
  return ok(res, null, 'Review deleted');
});

// ---------------------------------------------------------------------------
// TESTIMONIALS
// ---------------------------------------------------------------------------
const listTestimonials = asyncHandler(async (req, res) => {
  return ok(res, await reviewModel.listTestimonials(req.query.status));
});

const createTestimonial = asyncHandler(async (req, res) => {
  const id = await reviewModel.createTestimonial(req.body);
  await cache.delByPrefix('home:');
  return created(res, { review_id: id }, 'Testimonial added');
});

const updateTestimonial = asyncHandler(async (req, res) => {
  await reviewModel.updateTestimonial(req.params.id, req.body);
  await cache.delByPrefix('home:');
  return ok(res, null, 'Testimonial updated');
});

const removeTestimonial = asyncHandler(async (req, res) => {
  await reviewModel.removeTestimonial(req.params.id);
  await cache.delByPrefix('home:');
  return ok(res, null, 'Testimonial deleted');
});

module.exports = {
  listCategories, categoryTree, categoryDetail, createCategory, updateCategory, removeCategory,
  listBrands, createBrand, updateBrand, removeBrand, mergeBrands,
  listCoupons, couponDetail, createCoupon, updateCoupon, removeCoupon, couponUsage,
  listReviews, moderateReview, removeReview,
  listTestimonials, createTestimonial, updateTestimonial, removeTestimonial,
};