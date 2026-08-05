const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const ApiError = require("../../utils/ApiError");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");

const router = express.Router();
router.use(requireAdmin);

// ---------- Email templates ----------
// Keys in use by the app: OTP is SMS-only; email keys include CONTACT_AUTOREPLY.
// Add more keys here as you wire sendTemplatedEmail(...) calls elsewhere (order
// confirmation, shipping update, etc.) — the key is just a lookup string.
router.get("/email", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, templates: await prisma.emailTemplate.findMany({ orderBy: { key: "asc" } }) });
}));

router.post("/email", requirePermission("blogs", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ key: z.string().min(2), subject: z.string().min(2), bodyHtml: z.string().min(2) });
  const data = schema.parse(req.body);
  const existing = await prisma.emailTemplate.findUnique({ where: { key: data.key } });
  if (existing) throw new ApiError(409, "A template with this key already exists — edit it instead");
  const template = await prisma.emailTemplate.create({ data });
  res.status(201).json({ success: true, template });
}));

router.put("/email/:id", requirePermission("blogs", "edit"), asyncHandler(async (req, res) => {
  const schema = z.object({ subject: z.string().min(2).optional(), bodyHtml: z.string().min(2).optional() });
  const template = await prisma.emailTemplate.update({ where: { id: req.params.id }, data: schema.parse(req.body) });
  res.json({ success: true, template });
}));

router.delete("/email/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.emailTemplate.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ---------- SMS templates ----------
// Key "OTP" is used by auth.routes.js for login/register OTP messages.
router.get("/sms", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, templates: await prisma.smsTemplate.findMany({ orderBy: { key: "asc" } }) });
}));

router.post("/sms", requirePermission("blogs", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ key: z.string().min(2), body: z.string().min(2) });
  const data = schema.parse(req.body);
  const existing = await prisma.smsTemplate.findUnique({ where: { key: data.key } });
  if (existing) throw new ApiError(409, "A template with this key already exists — edit it instead");
  const template = await prisma.smsTemplate.create({ data });
  res.status(201).json({ success: true, template });
}));

router.put("/sms/:id", requirePermission("blogs", "edit"), asyncHandler(async (req, res) => {
  const { body } = z.object({ body: z.string().min(2) }).parse(req.body);
  const template = await prisma.smsTemplate.update({ where: { id: req.params.id }, data: { body } });
  res.json({ success: true, template });
}));

router.delete("/sms/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.smsTemplate.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

module.exports = router;
