const productModel = require('../../models/product.model');
const categoryModel = require('../../models/category.model');
const reviewModel = require('../../models/review.model');
const settingsModel = require('../../models/settings.model');
const wishlistModel = require('../../models/wishlist.model');
const cache = require('../../utils/cache');
const { ok, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination, getSort } = require('../../utils/helpers');

/** GET /products */
const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 20, 50);
  const sort = getSort(req.query, productModel.SORTABLE, 'product_id');

  const filters = {
    status: 'Active',
    category_id: req.query.category_id,
    brand_id: req.query.brand_id,
    search: req.query.search,
    min_price: req.query.min_price,
    max_price: req.query.max_price,
    top_selling: req.query.top_selling,
    latest_product: req.query.latest,
    deal_of_the_day: req.query.deals,
    prescription_required: req.query.prescription_required,
    in_stock: req.query.in_stock === 'true',
  };

  const key = cache.buildKey('products:list', { ...filters, page, limit, sort: `${sort.column}:${sort.direction}` });
  const { rows, total } = await cache.getOrSet(key, cache.TTL.MEDIUM,
    () => productModel.list(filters, { limit, offset }, sort));

  return paginated(res, rows, total, page, limit);
});

/** GET /products/:slug */
const productDetail = asyncHandler(async (req, res) => {
  const key = `products:detail:${req.params.slug}`;
  const product = await cache.getOrSet(key, cache.TTL.MEDIUM, () => productModel.findBySlug(req.params.slug));
  if (!product) return fail(res, 'Product not found', 404);
  
  const related = await cache.getOrSet(`products:related:${product.product_id}`, cache.TTL.LONG,
    () => productModel.related(product.product_id, 8));

  // the wishlist flag is only for a logged-in user (hence outside the cache)
  let inWishlist = false;
  if (req.customer) inWishlist = await wishlistModel.has(req.customer.customer_id, product.product_id);

  return ok(res, { ...product, related, in_wishlist: inWishlist });
});

/** GET /products/:productId/reviews */
const productReviews = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 10, 50);
  const { rows, total, breakdown } = await reviewModel.listByProduct(req.params.productId, { limit, offset });
  return paginated(res, rows, total, page, limit, { breakdown });
});

/** GET /categories */
const listCategories = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('categories:list', cache.TTL.LONG,
    () => categoryModel.list({ status: 'Active' }));
  return ok(res, data.rows);
});

/** GET /categories/tree — nested menu */
const categoryTree = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('categories:tree', cache.TTL.LONG, () => categoryModel.tree('Active'));
  return ok(res, data);
});

/** GET /categories/:slug */
const categoryDetail = asyncHandler(async (req, res) => {
  const category = await cache.getOrSet(`categories:slug:${req.params.slug}`, cache.TTL.LONG,
    () => categoryModel.findBySlug(req.params.slug));
  if (!category) return fail(res, 'Category not found', 404);
  return ok(res, category);
});

/**
 * GET /categories/:slug/products — every Active product in this category,
 * no page-size cap. Deliberately separate from the shared /products listing
 * (shop/search/admin all hit that one and its limit stays capped) — the
 * category page needs the full set at once for its client-side filters.
 */
const categoryProducts = asyncHandler(async (req, res) => {
  const category = await cache.getOrSet(`categories:slug:${req.params.slug}`, cache.TTL.LONG,
    () => categoryModel.findBySlug(req.params.slug));
  if (!category) return fail(res, 'Category not found', 404);

  const key = cache.buildKey('products:by-category', { category_id: category.category_id });
  const products = await cache.getOrSet(key, cache.TTL.MEDIUM,
    () => productModel.listAllByCategory(category.category_id));

  return ok(res, { category, products, total: products.length });
});

/**
 * GET /home — all homepage data in a single call.
 * The app does not need to hit 8 separate APIs, and the whole response is cached.
 */
const home = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('home:feed', cache.TTL.MEDIUM, async () => {
    const [banners, categories, brands, deals, offers, testimonials, settings] = await Promise.all([
      settingsModel.listBanners('Active'),
      categoryModel.tree('Active'),
      settingsModel.listPublicBrands(),
      settingsModel.listDeals(true),
      settingsModel.listOffers(true),
      reviewModel.listTestimonials('active'),
      settingsModel.get(),
    ]);

    const [topSelling, latest, dealProducts] = await Promise.all([
      productModel.list({ status: 'Active', top_selling: '1' }, { limit: 12, offset: 0 }),
      productModel.list({ status: 'Active', latest_product: '1' }, { limit: 12, offset: 0 }),
      productModel.list({ status: 'Active', deal_of_the_day: '1' }, { limit: 12, offset: 0 }),
    ]);

    return {
      banners,
      categories,
      brands: brands.rows.slice(0, 24),
      deals,
      offers,
      testimonials,
      top_selling: topSelling.rows,
      latest_products: latest.rows,
      deal_of_the_day: dealProducts.rows,
      settings: settings ? {
        organization: settings.organization,
        logo: settings.logo,
        contact_phone: settings.contact_phone,
        contact_email: settings.contact_email,
        contact_address: settings.contact_address,
        facebook_link: settings.facebook_link,
        instagram_link: settings.instagram_link,
        twitter_link: settings.twitter_link,
        shipping_charge: settings.shipping_charge,
        shipping_threshold: settings.shipping_threshold,
        is_cod: settings.is_cod,
        cod_fee: settings.cod_fee,
        cod_advance: settings.cod_advance,
      } : null,
    };
  });

  return ok(res, data);
});

/** GET /search?q= — quick autocomplete */
const search = asyncHandler(async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 2) return ok(res, { products: [], categories: [] });

  const key = `products:search:${q.toLowerCase()}`;
  const data = await cache.getOrSet(key, cache.TTL.SHORT, async () => {
    const [products, categories] = await Promise.all([
      productModel.list({ status: 'Active', search: q }, { limit: 10, offset: 0 }),
      categoryModel.list({ status: 'Active', search: q }),
    ]);
    return {
      products: products.rows.map((p) => ({
        product_id: p.product_id, product_name: p.product_name, slug: p.slug,
        image_1: p.image_1, product_sp: p.product_sp, product_mrp: p.product_mrp,
        stock: p.stock, stock_quantity: p.stock_quantity, allow_backorder: p.allow_backorder,
        presciption_required: p.presciption_required, weight_quantity: p.weight_quantity,
        salt: p.salt, brand_id: p.brand_id, brand_name: p.brand_name, company_name: p.company_name,
      })),
      categories: categories.rows.map((c) => ({
        category_id: c.category_id, category_name: c.category_name, slug: c.slug,
      })),
    };
  });
  return ok(res, data);
});

/** GET /serviceable-city?city= — whether delivery is available */
const checkServiceability = asyncHandler(async (req, res) => {
  const city = req.query.city;
  if (!city) return fail(res, 'The city query param is required', 422);

  const found = await settingsModel.checkCity(city);
  return ok(res, {
    serviceable: !!found,
    estimated_delivery: found?.E_T_D || null,
  });
});

/**
 * GET /brands — every active brand, with its product count.
 * This backs the "All Brands" page — no limit, no status guessing.
 */
const listBrands = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('brands:all', cache.TTL.MEDIUM, async () => {
    const { rows } = await settingsModel.listPublicBrands();
    return rows;
  });
  return ok(res, data);
});

module.exports = {
  listProducts, productDetail, productReviews, listBrands,
  listCategories, categoryTree, categoryDetail, categoryProducts,
  home, search, checkServiceability,
};