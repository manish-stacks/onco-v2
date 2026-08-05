const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Shared logic used here and by order.routes.js at checkout time
async function validateCoupon(code, userId, cartSubtotal) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || !coupon.isActive) throw new ApiError(400, "Invalid coupon code");
  if (coupon.startsAt && coupon.startsAt > new Date()) throw new ApiError(400, "Coupon not yet active");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new ApiError(400, "Coupon expired");
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new ApiError(400, "Coupon usage limit reached");
  if (coupon.minOrderValue && cartSubtotal < Number(coupon.minOrderValue)) {
    throw new ApiError(400, `Minimum order value ₹${coupon.minOrderValue} required`);
  }

  const userUsage = await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
  if (userUsage >= coupon.perUserLimit) throw new ApiError(400, "Coupon already used");

  let discount = coupon.discountType === "PERCENTAGE" ? (cartSubtotal * Number(coupon.discountValue)) / 100 : Number(coupon.discountValue);
  if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.min(discount, cartSubtotal);

  return { coupon, discount };
}

// POST /api/coupons/validate
router.post(
  "/validate",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string() }).parse(req.body);

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: { product: true, variant: true },
    });
    const subtotal = cartItems.reduce((s, i) => s + (i.variant ? Number(i.variant.sellingPrice) : Number(i.product.sellingPrice)) * i.qty, 0);

    const { coupon, discount } = await validateCoupon(code, req.userId, subtotal);
    res.json({ success: true, coupon: { code: coupon.code, description: coupon.description }, discount, subtotal });
  })
);

module.exports = router;
module.exports.validateCoupon = validateCoupon;
