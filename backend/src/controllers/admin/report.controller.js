const reportModel = require('../../models/report.model');
const inventoryModel = require('../../models/inventory.model');
const cache = require('../../utils/cache');
const { ok, asyncHandler } = require('../../utils/response');
const { dateRangeFromPreset, toCsv } = require('../../utils/helpers');

/** Har report ke liye common date-range resolve */
function resolveFilters(query) {
  const range = query.from_date
    ? { from: query.from_date, to: query.to_date }
    : dateRangeFromPreset(query.preset || 'month');

  return {
    from_date: range.from,
    to_date: range.to,
    orderFrom: query.orderFrom,
    include_cancelled: query.include_cancelled === 'true',
  };
}

function cached(namespace, filters, extra, fn) {
  return cache.getOrSet(
    cache.buildKey(`reports:${namespace}`, { ...filters, ...extra }),
    cache.TTL.MEDIUM,
    fn
  );
}

/** GET /admin/reports/sales */
const sales = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const groupBy = req.query.group_by || 'day';

  const data = await cached('sales', filters, { groupBy }, async () => {
    const [summary, trend, bySource, byStatus, byPayment] = await Promise.all([
      reportModel.salesSummary(filters),
      reportModel.salesTrend(filters, groupBy),
      reportModel.salesBySource(filters),
      reportModel.salesByStatus(filters),
      reportModel.salesByPaymentMode(filters),
    ]);
    return { summary, trend, by_source: bySource, by_status: byStatus, by_payment: byPayment };
  });

  return ok(res, { period: { from: filters.from_date, to: filters.to_date }, ...data });
});

/** GET /admin/reports/products */
const products = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const limit = parseInt(req.query.limit, 10) || 20;

  const data = await cached('products', filters, { limit }, async () => {
    const [top, categories, nonMoving] = await Promise.all([
      reportModel.topProducts(filters, limit),
      reportModel.categoryPerformance(filters, limit),
      reportModel.nonMovingProducts(parseInt(req.query.dead_days, 10) || 90, limit),
    ]);
    return { top_products: top, category_performance: categories, non_moving: nonMoving };
  });

  return ok(res, { period: { from: filters.from_date, to: filters.to_date }, ...data });
});

/** GET /admin/reports/customers */
const customers = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const limit = parseInt(req.query.limit, 10) || 20;

  const data = await cached('customers', filters, { limit }, async () => {
    const [top, retention, growth] = await Promise.all([
      reportModel.topCustomers(filters, limit),
      reportModel.customerRetention(filters),
      reportModel.customerGrowth(req.query.group_by || 'month', 12),
    ]);
    return { top_customers: top, retention, growth };
  });

  return ok(res, { period: { from: filters.from_date, to: filters.to_date }, ...data });
});

/** GET /admin/reports/inventory */
const inventory = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('reports:inventory', cache.TTL.SHORT, async () => {
    const [summary, low, out, expiring, nonMoving] = await Promise.all([
      inventoryModel.summary(),
      inventoryModel.lowStockProducts(100),
      inventoryModel.outOfStockProducts(100),
      inventoryModel.expiringProducts(parseInt(req.query.days, 10) || 90, 100),
      reportModel.nonMovingProducts(90, 50),
    ]);
    return { summary, low_stock: low, out_of_stock: out, expiring, non_moving: nonMoving };
  });
  return ok(res, data);
});

/** GET /admin/reports/locations?by=city|state */
const locations = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const by = req.query.by === 'state' ? 'state' : 'city';
  const data = await cached('locations', filters, { by }, () => reportModel.salesByLocation(filters, by, 50));
  return ok(res, { period: { from: filters.from_date, to: filters.to_date }, by, rows: data });
});

/** GET /admin/reports/prescriptions */
const prescriptions = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const data = await cached('prescriptions', filters, {}, () => reportModel.prescriptionStats({
    from_date: filters.from_date, to_date: filters.to_date, source: req.query.source,
  }));
  return ok(res, data);
});

/** GET /admin/reports/coupons */
const coupons = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const data = await cached('coupons', filters, {}, () => reportModel.couponPerformance(filters, 50));
  return ok(res, { period: { from: filters.from_date, to: filters.to_date }, rows: data });
});

/** GET /admin/reports/gst — accountant ke liye HSN-wise tax summary */
const gst = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const rows = await cached('gst', filters, {}, () => reportModel.gstReport(filters));

  if (req.query.format === 'csv') {
    const csv = toCsv(rows, ['hsn_code', 'tax_percent', 'orders', 'taxable_value', 'tax_amount']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gst-report-${Date.now()}.csv"`);
    return res.send(csv);
  }

  return ok(res, { period: { from: filters.from_date, to: filters.to_date }, rows });
});

/** GET /admin/reports/export?type=sales|products|customers */
const exportReport = asyncHandler(async (req, res) => {
  const filters = resolveFilters(req.query);
  const type = req.query.type || 'sales';

  let rows = [];
  let columns = [];

  switch (type) {
    case 'products':
      rows = await reportModel.topProducts(filters, 5000);
      columns = ['product_id', 'product_name', 'sku', 'units_sold', 'revenue', 'order_count', 'stock_quantity'];
      break;
    case 'customers':
      rows = await reportModel.topCustomers(filters, 5000);
      columns = ['customer_id', 'customer_name', 'mobile', 'email_id', 'platform', 'orders', 'total_spent', 'avg_order_value', 'last_order'];
      break;
    case 'locations':
      rows = await reportModel.salesByLocation(filters, req.query.by === 'state' ? 'state' : 'city', 5000);
      columns = ['location', 'orders', 'revenue'];
      break;
    default:
      rows = await reportModel.salesTrend(filters, req.query.group_by || 'day');
      columns = ['period', 'orders', 'revenue', 'customers'];
  }

  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.csv"`);
  return res.send(csv);
});

module.exports = {
  sales, products, customers, inventory, locations, prescriptions, coupons, gst, exportReport,
};
