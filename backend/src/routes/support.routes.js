const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tickets = await prisma.supportTicket.findMany({ where: { userId: req.userId }, orderBy: { updatedAt: "desc" } });
    res.json({ success: true, tickets });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      subject: z.string().min(3),
      message: z.string().min(5),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
      orderId: z.string().optional(),
    });
    const { subject, message, priority, orderId } = schema.parse(req.body);

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.userId, subject, priority, orderId,
        messages: { create: { senderType: "USER", senderId: req.userId, message } },
      },
    });
    res.status(201).json({ success: true, ticket });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) throw new ApiError(404, "Ticket not found");
    res.json({ success: true, ticket });
  })
);

router.post(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const { message } = z.object({ message: z.string().min(1) }).parse(req.body);
    const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!ticket) throw new ApiError(404, "Ticket not found");

    const msg = await prisma.supportTicketMessage.create({
      data: { ticketId: ticket.id, senderType: "USER", senderId: req.userId, message },
    });
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
    }
    res.status(201).json({ success: true, message: msg });
  })
);

module.exports = router;
