const cmsModel = require('../../models/cms.model');
const settingsModel = require('../../models/settings.model');
const cache = require('../../utils/cache');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

/** GET /pages/:slug — about-us, privacy-policy, terms, etc. */
const page = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet(`cms:page:${req.params.slug}`, cache.TTL.LONG,
    () => cmsModel.findPageBySlug(req.params.slug));
  if (!data) return fail(res, 'Page nahi mila', 404);
  return ok(res, data);
});

/** GET /pages */
const pages = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('cms:pages', cache.TTL.LONG,
    () => cmsModel.listPages({ status: 'Active' }));
  return ok(res, data.map((p) => ({ page_id: p.page_id, name: p.name, slug: p.slug, type: p.type })));
});

/** GET /news */
const news = asyncHandler(async (req, res) => {
  const { page: p, limit, offset } = getPagination(req.query, 10, 50);
  const key = cache.buildKey('cms:news', { page: p, limit, category: req.query.category });
  const { rows, total } = await cache.getOrSet(key, cache.TTL.LONG,
    () => cmsModel.listNews({ status: 'active', category: req.query.category }, { limit, offset }));
  return paginated(res, rows, total, p, limit);
});

/** GET /news/:id */
const newsDetail = asyncHandler(async (req, res) => {
  const item = await cache.getOrSet(`cms:news:${req.params.id}`, cache.TTL.LONG,
    () => cmsModel.findNewsById(req.params.id));
  if (!item || item.status !== 'active') return fail(res, 'News nahi mili', 404);
  return ok(res, item);
});

/** POST /contact — enquiry form */
const submitEnquiry = asyncHandler(async (req, res) => {
  const id = await cmsModel.createEnquiry(req.body);
  return created(res, { id }, 'Aapka message mil gaya, jaldi contact karenge');
});

/** GET /settings — public config (secrets nahi) */
const publicSettings = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('settings:public', cache.TTL.LONG, async () => {
    const s = await settingsModel.get();
    if (!s) return null;
    return {
      organization: s.organization,
      logo: s.logo,
      contact_address: s.contact_address,
      contact_phone: s.contact_phone,
      contact_email: s.contact_email,
      copyright: s.copyright,
      facebook_link: s.facebook_link,
      twitter_link: s.twitter_link,
      instagram_link: s.instagram_link,
      shipping_charge: s.shipping_charge,
      shipping_threshold: s.shipping_threshold,
      is_cod: s.is_cod,
      cod_fee: s.cod_fee,
    };
  });
  return ok(res, data);
});

/** GET /locations/states + /locations/countries */
const states = asyncHandler(async (req, res) => {
  return ok(res, await cache.getOrSet('locations:states', cache.TTL.VERY_LONG, () => settingsModel.listStates()));
});

const countries = asyncHandler(async (req, res) => {
  return ok(res, await cache.getOrSet('locations:countries', cache.TTL.VERY_LONG, () => settingsModel.listCountries()));
});

const serviceableCities = asyncHandler(async (req, res) => {
  return ok(res, await cache.getOrSet('locations:cities', cache.TTL.LONG, () => settingsModel.listCities(true)));
});

module.exports = {
  page, pages, news, newsDetail, submitEnquiry, publicSettings,
  states, countries, serviceableCities,
};
