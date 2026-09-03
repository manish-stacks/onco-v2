const cmsModel = require('../../models/cms.model');
const settingsModel = require('../../models/settings.model');
const subscriberModel = require('../../models/subscriber.model');
const mail = require('../../services/mail.service');
const cache = require('../../utils/cache');
const { ok, created, fail, paginated, asyncHandler } = require('../../utils/response');
const { getPagination } = require('../../utils/helpers');

/** GET /pages/:slug — about-us, privacy-policy, terms, etc. */
const page = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet(`cms:page:${req.params.slug}`, cache.TTL.LONG,
    () => cmsModel.findPageBySlug(req.params.slug));
  if (!data) return fail(res, 'Page not found', 404);
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
  if (!item || item.status !== 'active') return fail(res, 'Article not found', 404);
  return ok(res, item);
});

/** POST /contact — enquiry form */
const submitEnquiry = asyncHandler(async (req, res) => {
  const { name, email, issue, message } = req.body;
  const id = await cmsModel.createEnquiry(req.body);

  // Mail is best-effort — a slow/broken SMTP server must never block the
  // customer's "message received" response, so we don't await it inline.
  (async () => {
    const settings = await settingsModel.get().catch(() => null);
    const orgName = settings?.organization || 'OncoHealthmart';
    const adminEmail = settings?.contact_email;

    if (adminEmail) {
      await mail.send(
        adminEmail,
        `New contact enquiry — ${issue || 'General'}`,
        `<h2>New enquiry from the website</h2>
         <p><b>Name:</b> ${name}</p>
         <p><b>Email:</b> ${email}</p>
         <p><b>Subject:</b> ${issue || '-'}</p>
         <p><b>Message:</b><br/>${String(message || '').replace(/\n/g, '<br/>')}</p>`
      );
    }

    await mail.send(
      email,
      `We've received your message — ${orgName}`,
      `<p>Hi ${name},</p>
       <p>Thanks for reaching out to ${orgName}. Our team has received your message and will get back to you within 24 hours.</p>
       <p style="color:#888;font-size:12px">This is an automated confirmation, please do not reply to this email.</p>`
    );
  })().catch((err) => console.error('[contact] notification mail failed:', err.message));

  return created(res, { id }, 'We have received your message and will contact you soon');
});

/** POST /subscribe — footer/homepage newsletter form */
const subscribeNewsletter = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, 'Please enter a valid email address', 422);
  }

  await subscriberModel.subscribe(email, req.body.source || 'website');

  mail.send(
    email,
    'You\'re subscribed!',
    `<p>Thanks for subscribing — you'll now get medication reminders, exclusive offers and health tips in your inbox.</p>`
  ).catch((err) => console.error('[subscribe] welcome mail failed:', err.message));

  return created(res, null, 'Subscribed successfully');
});

/** GET /settings — public config (no secrets) */
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
      default_gst: s.default_gst,
      gst_override: s.gst_override,
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
  page, pages, news, newsDetail, submitEnquiry, subscribeNewsletter, publicSettings,
  states, countries, serviceableCities,
};
