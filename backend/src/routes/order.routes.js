const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");
const { validateCoupon } = require("./coupon.routes");

const router = express.Router();
router.use(requireAuth);

const TAX_RATE_FALLBACK = 0.12; // used only if a product has no explicit taxRate

function genOrderNumber() {
  return "OHM" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 900 + 100);
}

async function computeShippingCharge(pincode, subtotal) {
  const pin = await prisma.pinCode.findUnique({ where: { pincode } });
  if (pin && !pin.isServiceable) throw new ApiError(400, "Delivery not available at this pincode");

  const zone = await prisma.shippingZone.findFirst({ where: { isActive: true } });
  if (!zone) return 0;
  if (zone.freeAboveAmt && subtotal >= Number(zone.freeAboveAmt)) return 0;
  return Number(zone.baseCharge);
}

// POST /api/orders/checkout - creates an order from the current cart
router.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      addressId: z.string(),
      paymentMethod: z.enum(["COD", "RAZORPAY"]),
      couponCode: z.string().optional(),
      prescriptionId: z.string().optional(),
    });
    const { addressId, paymentMethod, couponCode, prescriptionId } = schema.parse(req.body);

    const address = await prisma.address.findFirst({ where: { id: addressId, userId: req.userId } });
    if (!address) throw new ApiError(404, "Address not found");

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: { product: { include: { taxRate: true } }, variant: true },
    });
    if (cartItems.length === 0) throw new ApiError(400, "Cart is empty");

    // stock check
    for (const item of cartItems) {
      const availableStock = item.variant ? item.variant.stockQty : item.product.stockQty;
      if (item.product.isTrackInventory && availableStock < item.qty) {
        throw new ApiError(400, `"${item.product.name}" has insufficient stock`);
      }
    }

    // prescription requirement gate — real compliance check, not decorative
    const needsPrescription = cartItems.some((i) => i.product.requiresPrescription);
    if (needsPrescription && !prescriptionId) {
      throw new ApiError(400, "This order contains prescription medicines. Please upload a valid prescription first.");
    }
    if (prescriptionId) {
      const rx = await prisma.prescription.findFirst({ where: { id: prescriptionId, userId: req.userId } });
      if (!rx) throw new ApiError(404, "Prescription not found");
    }

    let subtotal = 0;
    let taxAmount = 0;
    const orderItemsData = [];

    for (const item of cartItems) {
      const price = item.variant ? Number(item.variant.sellingPrice) : Number(item.product.sellingPrice);
      const mrp = item.variant ? Number(item.variant.mrp) : Number(item.product.mrp);
      const lineTotal = price * item.qty;
      subtotal += lineTotal;

      const taxRate = item.product.taxRate ? Number(item.product.taxRate.rate) : TAX_RATE_FALLBACK * 100;
      taxAmount += (lineTotal * taxRate) / 100;

      orderItemsData.push({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.product.name,
        sku: item.variant ? item.variant.sku : item.product.sku,
        qty: item.qty,
        mrp,
        sellingPrice: price,
        total: lineTotal,
      });
    }

    let discountAmount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const result = await validateCoupon(couponCode, req.userId, subtotal);
      discountAmount = result.discount;
      appliedCoupon = result.coupon;
    }

    const shippingCharge = await computeShippingCharge(address.pincode, subtotal);
    const totalAmount = subtotal + taxAmount + shippingCharge - discountAmount;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: genOrderNumber(),
          userId: req.userId,
          shippingAddressId: address.id,
          paymentMethod,
          status: needsPrescription ? "PRESCRIPTION_REVIEW" : "CONFIRMED",
          requiresPrescriptionReview: needsPrescription,
          prescriptionId: prescriptionId || null,
          subtotal,
          taxAmount,
          shippingCharge,
          discountAmount,
          totalAmount,
          couponId: appliedCoupon ? appliedCoupon.id : null,
          items: { create: orderItemsData },
          timeline: { create: { status: needsPrescription ? "PRESCRIPTION_REVIEW" : "CONFIRMED", note: "Order placed" } },
        },
        include: { items: true },
      });

      // decrement stock
      for (const item of cartItems) {
        if (!item.product.isTrackInventory) continue;
        if (item.variantId) {
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQty: { decrement: item.qty } } });
        } else {
          await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.qty }, soldCount: { increment: item.qty } } });
        }
        await tx.inventoryLog.create({
          data: { productId: item.productId, changeQty: -item.qty, reason: "ORDER", refId: created.id },
        });
      }

      if (appliedCoupon) {
        await tx.coupon.update({ where: { id: appliedCoupon.id }, data: { usedCount: { increment: 1 } } });
        await tx.couponRedemption.create({ data: { couponId: appliedCoupon.id, userId: req.userId, orderId: created.id } });
      }

      await tx.cartItem.deleteMany({ where: { userId: req.userId } });

      return created;
    });

    // Payment record — COD settles on delivery; RAZORPAY needs a gateway order created client-side next
    if (paymentMethod === "COD") {
      await prisma.payment.create({ data: { orderId: order.id, gateway: "COD", amount: totalAmount, status: "PENDING" } });
    }

    res.status(201).json({ success: true, order });
  })
);

// POST /api/orders/:id/razorpay/create - creates a Razorpay order for an existing app order
// Requires RAZORPAY_KEY_ID/SECRET in .env — throws clearly if not configured yet.
router.post(
  "/:id/razorpay/create",
  asyncHandler(async (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new ApiError(501, "Razorpay keys not configured yet. Add RAZORPAY_KEY_ID/SECRET in .env.");
    }
    const Razorpay = require("razorpay"); // lazy require so app boots without the package if unused
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!order) throw new ApiError(404, "Order not found");

    const instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const rzpOrder = await instance.orders.create({
      amount: Math.round(Number(order.totalAmount) * 100),
      currency: "INR",
      receipt: order.orderNumber,
    });

    await prisma.payment.upsert({
      where: { orderId: order.id },
      update: { gateway: "RAZORPAY", gatewayOrderId: rzpOrder.id, amount: order.totalAmount },
      create: { orderId: order.id, gateway: "RAZORPAY", gatewayOrderId: rzpOrder.id, amount: order.totalAmount },
    });

    res.json({ success: true, razorpayOrderId: rzpOrder.id, amount: rzpOrder.amount, keyId: process.env.RAZORPAY_KEY_ID });
  })
);

// POST /api/orders/:id/razorpay/verify - verifies payment signature after checkout on the frontend
router.post(
  "/:id/razorpay/verify",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      razorpay_payment_id: z.string(),
      razorpay_order_id: z.string(),
      razorpay_signature: z.string(),
    });
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = schema.parse(req.body);

    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.userId }, include: { payment: true } });
    if (!order || !order.payment) throw new ApiError(404, "Order/payment not found");

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) throw new ApiError(400, "Payment verification failed");

    await prisma.payment.update({
      where: { orderId: order.id },
      data: { gatewayPaymentId: razorpay_payment_id, gatewaySignature: razorpay_signature, status: "PAID" },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });

    res.json({ success: true });
  })
);

// GET /api/orders - list current user's orders
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    res.json({ success: true, orders });
  })
);

// GET /api/orders/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { items: true, timeline: { orderBy: { createdAt: "asc" } }, shippingAddress: true, invoice: true, payment: true },
    });
    if (!order) throw new ApiError(404, "Order not found");
    res.json({ success: true, order });
  })
);

// POST /api/orders/:id/cancel
router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!order) throw new ApiError(404, "Order not found");
    if (["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
      throw new ApiError(400, "Order already dispatched, cannot be cancelled");
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledReason: reason } });
      await tx.orderTimeline.create({ data: { orderId: order.id, status: "CANCELLED", note: reason || "Cancelled by customer" } });

      const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const item of items) {
        if (item.variantId) {
          await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
        } else {
          await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } });
        }
        await tx.inventoryLog.create({ data: { productId: item.productId, changeQty: item.qty, reason: "ORDER", refId: order.id } });
      }
    });

    res.json({ success: true });
  })
);

// POST /api/orders/:id/return - request a return
router.post(
  "/:id/return",
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!order) throw new ApiError(404, "Order not found");
    if (order.status !== "DELIVERED") throw new ApiError(400, "Only delivered orders can be returned");

    const returnRequest = await prisma.returnRequest.create({
      data: { orderId: order.id, userId: req.userId, reason },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "RETURN_REQUESTED" } });

    res.status(201).json({ success: true, returnRequest });
  })
);

module.exports = router;
