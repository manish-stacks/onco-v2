const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission, requireRole } = require("../../middleware/adminAuth");
const { awardLoyaltyForDeliveredOrder } = require("../../utils/loyalty");

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/orders - list + filter by status
router.get(
  "/",
  requirePermission("orders", "view"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const where = {
      deletedAt: null,
      ...(req.query.status ? { status: req.query.status } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, phone: true } }, items: true },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  })
);

router.get(
  "/:id",
  requirePermission("orders", "view"),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, timeline: { orderBy: { createdAt: "asc" } }, user: true, shippingAddress: true, prescription: true, payment: true },
    });
    if (!order) throw new ApiError(404, "Order not found");
    res.json({ success: true, order });
  })
);

// PATCH /api/admin/orders/:id/status - advance order status
router.patch(
  "/:id/status",
  requirePermission("orders", "edit"),
  asyncHandler(async (req, res) => {
    const { status, note } = z
      .object({
        status: z.enum(["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
        note: z.string().optional(),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new ApiError(404, "Order not found");

    if (order.requiresPrescriptionReview && !order.pharmacistApprovedAt && status !== "CANCELLED") {
      throw new ApiError(400, "Order requires pharmacist prescription approval before it can proceed");
    }

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status } }),
      prisma.orderTimeline.create({ data: { orderId: order.id, status, note } }),
    ]);

    // fire-and-forget: only on the transition INTO Delivered (guarded by order.status
    // check above so a repeat call on an already-delivered order can't double-award)
    if (status === "DELIVERED" && order.status !== "DELIVERED") {
      awardLoyaltyForDeliveredOrder(order.id).catch((err) => console.error("Loyalty accrual failed:", err));
    }

    res.json({ success: true });
  })
);

// POST /api/admin/orders/:id/prescription/approve - PHARMACIST or SUPER_ADMIN only
router.post(
  "/:id/prescription/approve",
  requirePermission("orders", "edit"),
  requireRole("PHARMACIST", "SUPER_ADMIN"),
  asyncHandler(async (req, res) => {
    const { approved, note } = z.object({ approved: z.boolean(), note: z.string().optional() }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new ApiError(404, "Order not found");
    if (!order.requiresPrescriptionReview) throw new ApiError(400, "This order does not require prescription review");

    if (order.prescriptionId) {
      await prisma.prescription.update({
        where: { id: order.prescriptionId },
        data: { status: approved ? "APPROVED" : "REJECTED", reviewedById: req.admin.id, reviewNote: note },
      });
    }

    const newStatus = approved ? "CONFIRMED" : "CANCELLED";
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          pharmacistApprovedById: req.admin.id,
          pharmacistApprovedAt: new Date(),
          ...(approved ? {} : { cancelledReason: note || "Prescription rejected" }),
        },
      }),
      prisma.orderTimeline.create({
        data: { orderId: order.id, status: newStatus, note: approved ? "Prescription approved by pharmacist" : `Prescription rejected: ${note || ""}` },
      }),
    ]);

    res.json({ success: true });
  })
);

module.exports = router;
