const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId }, orderBy: { createdAt: "desc" }, take: 50,
    });
    res.json({ success: true, notifications, unreadCount: notifications.filter((n) => !n.isRead).length });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notif = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!notif) throw new ApiError(404, "Notification not found");
    await prisma.notification.update({ where: { id: notif.id }, data: { isRead: true } });
    res.json({ success: true });
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.userId, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  })
);

module.exports = router;
