const BRAND = '#0E7C7B';   // clinical teal — matches admin panel primary colour
const DARK = '#12212B';    // header/footer navy
const BORDER = '#e6e9ea';

const STATUS_COLORS = {
  processing: '#1D5FA8',
  shipped: '#8A5A00',
  delivered: '#1B7F4D',
  cancelled: '#B3261E',
  canceled: '#B3261E',
};

function esc(v) {
  return String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/** Wraps any inner HTML in the branded header/footer shell. */
function layout({ settings = {}, preheader = '', bodyHtml = '' }) {
  const orgName = settings.organization || 'OncoHealthMart';
  const logo = settings.logo;
  const address = [settings.contact_address].filter(Boolean).join(', ');
  const contactLine = [settings.contact_phone, settings.contact_email].filter(Boolean).join('  ·  ');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${BORDER};">
        <tr>
          <td align="center" style="background:${DARK};padding:22px 24px;">
            ${logo
              ? `<img src="${esc(logo)}" alt="${esc(orgName)}" height="40" style="height:40px;max-width:220px;object-fit:contain;">`
              : `<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.3px;">${esc(orgName)}</span>`}
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px;color:${DARK};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;">
            <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 20px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7680;text-align:center;">
              This is an automated email — please do not reply directly to it.
            </p>
            <p style="margin:0;font-size:12px;color:#98a1a8;text-align:center;line-height:1.6;">
              <strong style="color:#6b7680;">${esc(orgName)}</strong>${address ? ` · ${esc(address)}` : ''}<br>
              ${contactLine ? esc(contactLine) : ''}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Small pill used for order status. */
function statusBadge(status) {
  const key = String(status || '').toLowerCase();
  const color = STATUS_COLORS[key] || BRAND;
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color}1a;color:${color};font-size:13px;font-weight:700;">${esc(status)}</span>`;
}

/** Heading + intro line, used at the top of every email body. */
function heading(title, introHtml) {
  return `<h1 style="margin:0 0 10px;font-size:20px;color:${DARK};">${esc(title)}</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#3c454c;">${introHtml}</p>`;
}

/** Styled order items table. */
function itemsTable(items) {
  const rows = (items || []).map((it) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:${DARK};">${esc(it.product_name || 'Item')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:#3c454c;text-align:center;">${esc(it.unit_quantity)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:${DARK};text-align:right;">${esc(it.line_total)}</td>
    </tr>`).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 18px;border:1px solid ${BORDER};border-radius:6px;overflow:hidden;">
    <thead>
      <tr style="background:#f7f9f9;">
        <th align="left" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#6b7680;">Item</th>
        <th align="center" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#6b7680;">Qty</th>
        <th align="right" style="padding:10px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:#6b7680;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/** Key/value summary block (order id, total, payment method, address, ...). */
function infoRows(rows) {
  const trs = rows.filter((r) => r && r[1]).map(([label, value]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#6b7680;width:38%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:6px 0;font-size:13px;color:${DARK};font-weight:600;">${value}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;">${trs}</table>`;
}

function button(url, label) {
  if (!url) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr><td style="border-radius:6px;background:${BRAND};">
    <a href="${esc(url)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

/**
 * Charge breakdown block — subtotal, discount, shipping, COD fee, COD advance
 * split, GST, total. Only non-zero/relevant rows are shown. Used so an order
 * email shows exactly what the customer sees in the app/website, not just
 * the final total.
 */
function totalsTable(rows) {
  const trs = rows.filter((r) => r && r[1] !== undefined && r[1] !== null && r[1] !== '')
    .map(([label, value, bold]) => `
    <tr>
      <td style="padding:5px 0;font-size:${bold ? '15px' : '13px'};color:${bold ? DARK : '#6b7680'};font-weight:${bold ? '700' : '400'};">${esc(label)}</td>
      <td style="padding:5px 0;font-size:${bold ? '15px' : '13px'};color:${DARK};font-weight:${bold ? '700' : '600'};text-align:right;">${value}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-top:1px solid ${BORDER};padding-top:10px;">${trs}</table>`;
}

module.exports = { layout, heading, itemsTable, infoRows, totalsTable, button, statusBadge, esc, BRAND, DARK };
