const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);

router.get(
  "/",
  requirePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const where = req.query.status ? { status: req.query.status } : {};
    const tickets = await prisma.supportTicket.findMany({
      where, orderBy: { updatedAt: "desc" }, include: { user: { select: { name: true, phone: true } } },
    });
    res.json({ success: true, tickets });
  })
);

router.get(
  "/:id",
  requirePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: "asc" } }, user: { select: { name: true, phone: true, email: true } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    res.json({ success: true, ticket });
  })
);

router.post(
  "/:id/messages",
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const { message } = z.object({ message: z.string().min(1) }).parse(req.body);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) throw new ApiError(404, "Ticket not found");

    const msg = await prisma.supportTicketMessage.create({
      data: { ticketId: ticket.id, senderType: "ADMIN", senderId: req.admin.id, message },
    });
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "IN_PROGRESS" } });
    res.status(201).json({ success: true, message: msg });
  })
);

router.patch(
  "/:id/status",
  requirePermission("users", "edit"),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) }).parse(req.body);
    const ticket = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { status } });
    res.json({ success: true, ticket });
  })
);

module.exports = router;
