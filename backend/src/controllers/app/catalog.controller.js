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
    search: req.query.search,
    min_price: req.query.min_price,
    max_price: req.query.max_price,
    top_selling: req.query.top_selling,
    latest_product: req.query.latest,
    deal_of_the_day: req.query.deals,
    prescription_required: req.query.prescription_required,
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
  if (!product) return fail(res, 'Product nahi mila', 404);
  
  const related = await cache.getOrSet(`products:related:${product.product_id}`, cache.TTL.LONG,
    () => productModel.related(product.product_id, 8));

  // wishlist flag sirf logged-in user ke liye (isliye cache ke bahar)
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
  if (!category) return fail(res, 'Category nahi mili', 404);
  return ok(res, category);
});

/**
 * GET /home — homepage ka saara data ek call me.
 * App ko 8 alag API hit karne ki zaroorat nahi, aur poora response cached hai.
 */
const home = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('home:feed', cache.TTL.MEDIUM, async () => {
    const [banners, categories, brands, deals, offers, testimonials, settings] = await Promise.all([
      settingsModel.listBanners('Active'),
      categoryModel.tree('Active'),
      settingsModel.listBrands('active'),
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
      brands:brands.rows,
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
      })),
      categories: categories.rows.map((c) => ({
        category_id: c.category_id, category_name: c.category_name, slug: c.slug,
      })),
    };
  });
  return ok(res, data);
});

/** GET /serviceable-city?city= — delivery available hai ya nahi */
const checkServiceability = asyncHandler(async (req, res) => {
  const city = req.query.city;
  if (!city) return fail(res, 'city query param chahiye', 422);

  const found = await settingsModel.checkCity(city);
  return ok(res, {
    serviceable: !!found,
    estimated_delivery: found?.E_T_D || null,
  });
});

module.exports = {
  listProducts, productDetail, productReviews,
  listCategories, categoryTree, categoryDetail,
  home, search, checkServiceability,
};
