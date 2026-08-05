const prisma = require("../lib/prisma");

const POINTS_PER_100_SPENT = 1; // 1 reward point per ₹100 spent
const REFERRAL_BONUS_AMOUNT = 100; // ₹100 wallet credit to the referrer on the referred user's first delivered order

// Called when an order transitions to DELIVERED. Awards the buyer reward points,
// and — only on that buyer's very first delivered order — credits their referrer's
// wallet with a one-time referral bonus. Idempotent: if points were already awarded
// for this order (tracked via InventoryLog-style guard isn't applicable here, so we
// guard on order.status not already being DELIVERED before this call — callers must
// check that themselves to avoid double-crediting on repeated webhook/status calls).
async function awardLoyaltyForDeliveredOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
  if (!order) return;

  const pointsEarned = Math.floor(Number(order.totalAmount) / 100) * POINTS_PER_100_SPENT;
  if (pointsEarned > 0) {
    await prisma.user.update({ where: { id: order.userId }, data: { rewardPoints: { increment: pointsEarned } } });
  }

  if (!order.user.referredById) return; // no referrer, nothing more to do

  const deliveredCount = await prisma.order.count({ where: { userId: order.userId, status: "DELIVERED" } });
  if (deliveredCount !== 1) return; // referral bonus only fires once, on the first delivered order

  const last = await prisma.walletTransaction.findFirst({ where: { userId: order.user.referredById }, orderBy: { createdAt: "desc" } });
  const newBalance = Number(last?.balanceAfter || 0) + REFERRAL_BONUS_AMOUNT;

  await prisma.walletTransaction.create({
    data: {
      userId: order.user.referredById,
      type: "CREDIT",
      amount: REFERRAL_BONUS_AMOUNT,
      balanceAfter: newBalance,
      reason: `Referral bonus — ${order.user.name} completed their first order`,
      refId: order.id,
    },
  });
}

module.exports = { awardLoyaltyForDeliveredOrder, POINTS_PER_100_SPENT, REFERRAL_BONUS_AMOUNT };
