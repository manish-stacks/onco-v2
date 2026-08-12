const settingsModel = require('../../models/settings.model');
const cmsModel = require('../../models/cms.model');
const cache = require('../../utils/cache');
const { storeFile } = require('../../middleware/upload');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

// ---------------------------------------------------------------------------
// SITE SETTINGS
// ---------------------------------------------------------------------------
const getSettings = asyncHandler(async (req, res) => {
  return ok(res, await settingsModel.get());
});

const updateSettings = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.logo = await storeFile(req.file, 'settings');

  const updated = await settingsModel.update(req.params.id, data);
  if (!updated) return fail(res, 'Koi valid field nahi mila', 422);

  await cache.invalidate.settings();
  return ok(res, await settingsModel.get(), 'Settings update ho gayi');
});

// ---------------------------------------------------------------------------
// BANNERS
// ---------------------------------------------------------------------------

const listBanners = asyncHandler(async (req, res) => {
  const rows = await settingsModel.listBanners(
    req.query.status
  );

  return ok(res, rows);
});


const createBanner = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
  };
  console.log(req.body)

  // -------------------------------------------------------
  // Banner Type
  // -------------------------------------------------------
  const bannerType = String(data?.banner_type || '').trim().toLowerCase();

  if (!['normal', 'rich'].includes(bannerType)) {
    return res.status(422).json({
      success: false,
      message: 'Invalid banner type. Allowed: normal, rich',
    });
  }

  data.banner_type = bannerType;

  // -------------------------------------------------------
  // Image Upload
  // -------------------------------------------------------
  if (req.file) {
    data.banner_image = await storeFile(
      req.file,
      'banners'
    );
  }

  // -------------------------------------------------------
  // Create Banner
  // -------------------------------------------------------
  const id = await settingsModel.createBanner(data);

  // Clear cache
  await cache.invalidate.banners();

  return created(
    res,
    {
      banner_id: id,
    },
    'Banner add ho gaya'
  );
});


const updateBanner = asyncHandler(async (req, res) => {
  const data = {
    ...req.body,
  };

  // -------------------------------------------------------
  // Banner Type
  // -------------------------------------------------------
  if (
    data.banner_type !== undefined &&
    !['normal', 'rich'].includes(data.banner_type)
  ) {
    return res.status(422).json({
      success: false,
      message: 'Invalid banner type. Allowed: normal, rich',
    });
  }

  // -------------------------------------------------------
  // Image Upload
  // -------------------------------------------------------
  if (req.file) {
    data.banner_image = await storeFile(
      req.file,
      'banners'
    );
  }

  // -------------------------------------------------------
  // Update Banner
  // -------------------------------------------------------
  const updated = await settingsModel.updateBanner(
    req.params.bannerId,
    data
  );

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Banner nahi mila',
    });
  }

  // Clear cache
  await cache.invalidate.banners();

  return ok(
    res,
    null,
    'Banner update ho gaya'
  );
});


const removeBanner = asyncHandler(async (req, res) => {
  const deleted = await settingsModel.removeBanner(
    req.params.bannerId
  );

  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Banner nahi mila',
    });
  }

  // Clear cache
  await cache.invalidate.banners();

  return ok(
    res,
    null,
    'Banner delete ho gaya'
  );
});

// ---------------------------------------------------------------------------
// DEALS
// ---------------------------------------------------------------------------
const listDeals = asyncHandler(async (req, res) => ok(res, await settingsModel.listDeals()));

const createDeal = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = await storeFile(req.file, 'deals');
  const id = await settingsModel.createDeal(data);
  await cache.delByPrefix('home:');
  return created(res, { id }, 'Deal add ho gaya');
});

const updateDeal = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = await storeFile(req.file, 'deals');
  await settingsModel.updateDeal(req.params.dealId, data);
  await cache.delByPrefix('home:');
  return ok(res, null, 'Deal update ho gaya');
});

const removeDeal = asyncHandler(async (req, res) => {
  await settingsModel.removeDeal(req.params.dealId);
  await cache.delByPrefix('home:');
  return ok(res, null, 'Deal delete ho gaya');
});

// ---------------------------------------------------------------------------
// OFFERS (app cards)
// ---------------------------------------------------------------------------
const listOffers = asyncHandler(async (req, res) => ok(res, await settingsModel.listOffers()));

const createOffer = asyncHandler(async (req, res) => {
  const id = await settingsModel.createOffer(req.body);
  await cache.delByPrefix('home:');
  return created(res, { id }, 'Offer add ho gaya');
});

const updateOffer = asyncHandler(async (req, res) => {
  await settingsModel.updateOffer(req.params.offerId, req.body);
  await cache.delByPrefix('home:');
  return ok(res, null, 'Offer update ho gaya');
});

const removeOffer = asyncHandler(async (req, res) => {
  await settingsModel.removeOffer(req.params.offerId);
  await cache.delByPrefix('home:');
  return ok(res, null, 'Offer delete ho gaya');
});

// ---------------------------------------------------------------------------
// SERVICEABLE CITIES
// ---------------------------------------------------------------------------
const listCities = asyncHandler(async (req, res) => ok(res, await settingsModel.listCities()));

const createCity = asyncHandler(async (req, res) => {
  const id = await settingsModel.createCity(req.body);
  await cache.delByPrefix('locations:');
  return created(res, { id }, 'City add ho gayi');
});

const updateCity = asyncHandler(async (req, res) => {
  await settingsModel.updateCity(req.params.cityId, req.body);
  await cache.delByPrefix('locations:');
  return ok(res, null, 'City update ho gayi');
});

const removeCity = asyncHandler(async (req, res) => {
  await settingsModel.removeCity(req.params.cityId);
  await cache.delByPrefix('locations:');
  return ok(res, null, 'City delete ho gayi');
});

// ---------------------------------------------------------------------------
// CMS PAGES
// ---------------------------------------------------------------------------
const listPages = asyncHandler(async (req, res) => {
  return ok(res, await cmsModel.listPages({ status: req.query.status, type: req.query.type, search: req.query.search }));
});

const pageDetail = asyncHandler(async (req, res) => {
  const page = await cmsModel.findPageById(req.params.pageId);
  if (!page) return fail(res, 'Page nahi mila', 404);
  return ok(res, page);
});

const createPage = asyncHandler(async (req, res) => {
  const id = await cmsModel.createPage(req.body);
  await cache.invalidate.cms();
  return created(res, { page_id: id }, 'Page ban gaya');
});

const updatePage = asyncHandler(async (req, res) => {
  await cmsModel.updatePage(req.params.pageId, req.body);
  await cache.invalidate.cms();
  return ok(res, null, 'Page update ho gaya');
});

const removePage = asyncHandler(async (req, res) => {
  await cmsModel.removePage(req.params.pageId);
  await cache.invalidate.cms();
  return ok(res, null, 'Page delete ho gaya');
});

// ---------------------------------------------------------------------------
// NEWS / BLOG
// ---------------------------------------------------------------------------
const listNews = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await cmsModel.listNews({
    status: req.query.status, category: req.query.category, search: req.query.search,
  }, { limit, offset });
  return paginated(res, rows, total, page, limit);
});

const createNews = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = await storeFile(req.file, 'news');
  if (!data.date) data.date = new Date().toISOString().slice(0, 10);
  const id = await cmsModel.createNews(data);
  await cache.invalidate.cms();
  return created(res, { id }, 'News add ho gayi');
});

const updateNews = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = await storeFile(req.file, 'news');
  await cmsModel.updateNews(req.params.newsId, data);
  await cache.invalidate.cms();
  return ok(res, null, 'News update ho gayi');
});

const removeNews = asyncHandler(async (req, res) => {
  await cmsModel.removeNews(req.params.newsId);
  await cache.invalidate.cms();
  return ok(res, null, 'News delete ho gayi');
});

// ---------------------------------------------------------------------------
// CONTACT ENQUIRIES
// ---------------------------------------------------------------------------
const listEnquiries = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPagination(req.query, 25, 100);
  const { rows, total } = await cmsModel.listEnquiries({
    issue_solved: req.query.issue_solved,
    from_date: req.query.from_date,
    to_date: req.query.to_date,
    search: req.query.search,
  }, { limit, offset });
  return paginated(res, rows, total, page, limit);
});

const resolveEnquiry = asyncHandler(async (req, res) => {
  await cmsModel.markEnquirySolved(req.params.enquiryId, req.body.solved === false ? 0 : 1);
  return ok(res, null, 'Enquiry update ho gayi');
});

const removeEnquiry = asyncHandler(async (req, res) => {
  await cmsModel.removeEnquiry(req.params.enquiryId);
  return ok(res, null, 'Enquiry delete ho gayi');
});

module.exports = {
  getSettings, updateSettings,
  listBanners, createBanner, updateBanner, removeBanner,
  listDeals, createDeal, updateDeal, removeDeal,
  listOffers, createOffer, updateOffer, removeOffer,
  listCities, createCity, updateCity, removeCity,
  listPages, pageDetail, createPage, updatePage, removePage,
  listNews, createNews, updateNews, removeNews,
  listEnquiries, resolveEnquiry, removeEnquiry,
};
