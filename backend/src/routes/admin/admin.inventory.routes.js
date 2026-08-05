const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);

// ---------- Warehouses ----------
router.get("/warehouses", requirePermission("products", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, warehouses: await prisma.warehouse.findMany() });
}));

router.post("/warehouses", requirePermission("products", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string(), address: z.string(), city: z.string(), state: z.string(), pincode: z.string() });
  const warehouse = await prisma.warehouse.create({ data: schema.parse(req.body) });
  res.status(201).json({ success: true, warehouse });
}));

// ---------- Suppliers ----------
router.get("/suppliers", requirePermission("products", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, suppliers: await prisma.supplier.findMany({ orderBy: { name: "asc" } }) });
}));

router.post("/suppliers", requirePermission("products", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string(), email: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), gstNumber: z.string().optional() });
  const supplier = await prisma.supplier.create({ data: schema.parse(req.body) });
  res.status(201).json({ success: true, supplier });
}));

// ---------- Purchase Orders (receiving stock in) ----------
router.get("/purchase-orders", requirePermission("products", "view"), asyncHandler(async (req, res) => {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" }, include: { supplier: true, items: { include: { product: { select: { name: true, sku: true } } } } },
  });
  res.json({ success: true, purchaseOrders: orders });
}));

router.post("/purchase-orders", requirePermission("products", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({
    supplierId: z.string(),
    items: z.array(z.object({ productId: z.string(), qty: z.number().int().positive(), costPrice: z.number().positive() })).min(1),
  });
  const { supplierId, items } = schema.parse(req.body);
  const totalAmount = items.reduce((s, i) => s + i.qty * i.costPrice, 0);

  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId,
      poNumber: "PO" + Date.now().toString().slice(-8),
      totalAmount,
      items: { create: items },
    },
    include: { items: true },
  });
  res.status(201).json({ success: true, purchaseOrder: po });
}));

// POST /admin/inventory/purchase-orders/:id/receive - marks received, increments stock, logs inventory
router.post("/purchase-orders/:id/receive", requirePermission("products", "edit"), asyncHandler(async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!po) throw new ApiError(404, "Purchase order not found");
  if (po.status === "RECEIVED") throw new ApiError(400, "Already received");

  await prisma.$transaction(async (tx) => {
    for (const item of po.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } });
      await tx.inventoryLog.create({ data: { productId: item.productId, changeQty: item.qty, reason: "PURCHASE", refId: po.id } });
    }
    await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: "RECEIVED" } });
  });

  res.json({ success: true });
}));

// ---------- Manual stock adjustment ----------
router.post("/adjust-stock", requirePermission("products", "edit"), asyncHandler(async (req, res) => {
  const schema = z.object({ productId: z.string(), changeQty: z.number().int(), reason: z.string().default("Manual adjustment") });
  const { productId, changeQty, reason } = schema.parse(req.body);

  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { stockQty: { increment: changeQty } } }),
    prisma.inventoryLog.create({ data: { productId, changeQty, reason: "ADJUSTMENT" } }),
  ]);

  res.json({ success: true });
}));

// ---------- Inventory log view (audit trail) ----------
router.get("/logs", requirePermission("products", "view"), asyncHandler(async (req, res) => {
  const logs = await prisma.inventoryLog.findMany({
    orderBy: { createdAt: "desc" }, take: 100, include: { product: { select: { name: true, sku: true } } },
  });
  res.json({ success: true, logs });
}));

module.exports = router;
