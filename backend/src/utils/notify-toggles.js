const settingsModel = require('../models/settings.model');
const cache = require('./cache');

/**
 * Admin Settings me WhatsApp/SMS/Email notifications ka on-off toggle.
 * 60 second cache hai — admin panel me flag badalne ke 1 min ke andar
 * asar dikhega (turant nahi, lekin har order/status-change pe DB query
 * bachane ke liye ye trade-off theek hai).
 *
 * NOTE: ye sirf CUSTOMER-FACING order/prescription notifications ke liye
 * hai. Login OTP (sms.service.sendOtp) isse gate NAHI hota — warna SMS
 * disable karne pe customer login hi nahi kar payenge.
 */
async function isChannelEnabled(channel) {
  const flags = await cache.getOrSet('settings:notify-toggles', 60, async () => {
    const s = await settingsModel.get();
    const on = (v) => (v === undefined || v === null ? true : !!Number(v));
    return {
      whatsapp: on(s?.notify_whatsapp_enabled),
      sms: on(s?.notify_sms_enabled),
      email: on(s?.notify_email_enabled),
    };
  });
  return flags[channel] !== false;
}

module.exports = { isChannelEnabled };
