const express = require("express");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);

router.get(
  "/summary",
  requirePermission("dashboard", "view"),
  asyncHandler(async (req, res) => {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalOrders, totalRevenueAgg, totalUsers, totalProducts,
      pendingPrescriptionReviews, ordersLast30d, lowStockProducts, recentOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
      prisma.user.count(),
      prisma.product.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { requiresPrescriptionReview: true, pharmacistApprovedAt: null } }),
      prisma.order.count({ where: { createdAt: { gte: since30d } } }),
      // Prisma can't compare two columns of the same row directly, so use a raw SQL
      // query for "stock at or below its own low-stock threshold".
      prisma.$queryRaw`SELECT id, name, sku, stockQty, lowStockAlert FROM Product WHERE isTrackInventory = 1 AND deletedAt IS NULL AND stockQty <= lowStockAlert LIMIT 10`,
      prisma.order.findMany({ take: 8, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } }),
    ]);

    res.json({
      success: true,
      summary: {
        totalOrders,
        totalRevenue: totalRevenueAgg._sum.totalAmount || 0,
        totalUsers,
        totalProducts,
        pendingPrescriptionReviews,
        ordersLast30Days: ordersLast30d,
      },
      recentOrders,
    });
  })
);

module.exports = router;
