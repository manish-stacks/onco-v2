const orderModel = require('../../models/order.model');
const customerModel = require('../../models/customer.model');
const inventoryModel = require('../../models/inventory.model');
const prescriptionModel = require('../../models/prescription.model');
const reportModel = require('../../models/report.model');
const cache = require('../../utils/cache');
const { ok, asyncHandler } = require('../../utils/response');
const { dateRangeFromPreset } = require('../../utils/helpers');

/**
 * GET /admin/dashboard
 * Ek call me poora dashboard. 60s cache — har admin page load pe hit hota hai.
 * ?preset=today|week|month|year  ya  ?from_date=&to_date=
 */
const overview = asyncHandler(async (req, res) => {
  const preset = req.query.preset || 'month';
  const range = req.query.from_date
    ? { from: req.query.from_date, to: req.query.to_date }
    : dateRangeFromPreset(preset);

  const filters = { from_date: range.from, to_date: range.to };
  const key = cache.buildKey('admin:dashboard', { ...filters, preset });

  const data = await cache.getOrSet(key, cache.TTL.SHORT, async () => {
    const [
      orderStats, allTimeStats, customerStats, inventoryStats,
      prescStats, trend, topProducts, sourceSplit,
    ] = await Promise.all([
      orderModel.stats(filters),
      orderModel.stats({}),
      customerModel.stats(),
      inventoryModel.summary(),
      prescriptionModel.countByStatus(),
      reportModel.salesTrend(filters, preset === 'today' ? 'day' : 'day'),
      reportModel.topProducts(filters, 10),
      reportModel.salesBySource(filters),
    ]);

    const [lowStock, recentOrders] = await Promise.all([
      inventoryModel.lowStockProducts(10),
      orderModel.list({}, { limit: 10, offset: 0 }),
    ]);

    return {
      period: { preset, from: range.from, to: range.to },
      cards: {
        period_orders: orderStats.total_orders,
        period_revenue: orderStats.total_revenue,
        avg_order_value: orderStats.avg_order_value,
        lifetime_orders: allTimeStats.total_orders,
        lifetime_revenue: allTimeStats.total_revenue,
        total_customers: customerStats.total_customers,
        today_signups: customerStats.today_signups,
        total_products: inventoryStats.total_products,
        low_stock_count: inventoryStats.low_stock,
        out_of_stock_count: inventoryStats.out_of_stock,
        stock_value: inventoryStats.stock_value,
        expiring_soon: inventoryStats.expiring_soon,
        pending_prescriptions: prescStats.find((p) => p.status === 'Pending')?.count || 0,
      },
      orders_by_status: orderStats.byStatus,
      orders_by_source: sourceSplit,
      customers: customerStats,
      prescriptions_by_status: prescStats,
      sales_trend: trend,
      top_products: topProducts,
      low_stock_products: lowStock,
      recent_orders: recentOrders.rows,
    };
  });

  return ok(res, data);
});

/** GET /admin/dashboard/quick-stats — sirf cards, har 30s poll ke liye halka */
const quickStats = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet('admin:dashboard:quick', 30, async () => {
    const [orders, inventory, prescriptions] = await Promise.all([
      orderModel.stats(dateRangeFromPreset('today')),
      inventoryModel.summary(),
      prescriptionModel.countByStatus(),
    ]);
    return {
      today_orders: orders.total_orders,
      today_revenue: orders.total_revenue,
      pending_orders: orders.byStatus.find((s) => s.status === 'Pending')?.count || 0,
      new_orders: orders.byStatus.find((s) => s.status === 'New')?.count || 0,
      low_stock: inventory.low_stock,
      out_of_stock: inventory.out_of_stock,
      pending_prescriptions: prescriptions.find((p) => p.status === 'Pending')?.count || 0,
    };
  });
  return ok(res, data);
});

module.exports = { overview, quickStats };
