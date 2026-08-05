const express = require("express");
const { z } = require("zod");
const prisma = require("../../lib/prisma");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAdmin, requirePermission } = require("../../middleware/adminAuth");
const upload = require("../../middleware/upload");

const router = express.Router();
router.use(requireAdmin);

// ---------- Banners ----------
router.get("/banners", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, banners: await prisma.banner.findMany({ orderBy: { sortOrder: "asc" } }) });
}));

router.post("/banners", requirePermission("blogs", "create"), upload.single("image"), asyncHandler(async (req, res) => {
  const schema = z.object({ title: z.string(), linkUrl: z.string().optional(), placement: z.string(), sortOrder: z.coerce.number().default(0) });
  const data = schema.parse(req.body);
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;
  const banner = await prisma.banner.create({ data: { ...data, imageUrl } });
  res.status(201).json({ success: true, banner });
}));

router.patch("/banners/:id", requirePermission("blogs", "edit"), asyncHandler(async (req, res) => {
  const schema = z.object({ isActive: z.boolean().optional(), sortOrder: z.number().optional(), title: z.string().optional(), linkUrl: z.string().optional() });
  const data = schema.parse(req.body);
  const banner = await prisma.banner.update({ where: { id: req.params.id }, data });
  res.json({ success: true, banner });
}));

router.delete("/banners/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.banner.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ---------- Sliders ----------
router.get("/sliders", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, sliders: await prisma.slider.findMany({ orderBy: { sortOrder: "asc" } }) });
}));

router.post("/sliders", requirePermission("blogs", "create"), upload.single("image"), asyncHandler(async (req, res) => {
  const schema = z.object({ title: z.string(), linkUrl: z.string().optional(), sortOrder: z.coerce.number().default(0) });
  const data = schema.parse(req.body);
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl;
  const slider = await prisma.slider.create({ data: { ...data, imageUrl } });
  res.status(201).json({ success: true, slider });
}));

router.delete("/sliders/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.slider.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ---------- Testimonials ----------
router.get("/testimonials", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, testimonials: await prisma.testimonial.findMany({ orderBy: { createdAt: "desc" } }) });
}));

router.post("/testimonials", requirePermission("blogs", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string(), photoUrl: z.string().optional(), rating: z.number().min(1).max(5).default(5), message: z.string(), isApproved: z.boolean().default(true) });
  const data = schema.parse(req.body);
  const testimonial = await prisma.testimonial.create({ data });
  res.status(201).json({ success: true, testimonial });
}));

router.patch("/testimonials/:id", requirePermission("blogs", "edit"), asyncHandler(async (req, res) => {
  const { isApproved } = z.object({ isApproved: z.boolean() }).parse(req.body);
  const testimonial = await prisma.testimonial.update({ where: { id: req.params.id }, data: { isApproved } });
  res.json({ success: true, testimonial });
}));

router.delete("/testimonials/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.testimonial.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ---------- FAQs ----------
router.get("/faqs", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, faqs: await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } }) });
}));

router.post("/faqs", requirePermission("blogs", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ question: z.string(), answer: z.string(), category: z.string().optional(), sortOrder: z.number().default(0) });
  const data = schema.parse(req.body);
  const faq = await prisma.faq.create({ data });
  res.status(201).json({ success: true, faq });
}));

router.delete("/faqs/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.faq.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

// ---------- Menus ----------
router.get("/menus", requirePermission("blogs", "view"), asyncHandler(async (req, res) => {
  res.json({ success: true, menus: await prisma.menu.findMany({ orderBy: { sortOrder: "asc" } }) });
}));

router.post("/menus", requirePermission("blogs", "create"), asyncHandler(async (req, res) => {
  const schema = z.object({ label: z.string(), url: z.string(), parentId: z.string().nullable().optional(), sortOrder: z.number().default(0) });
  const data = schema.parse(req.body);
  const menu = await prisma.menu.create({ data });
  res.status(201).json({ success: true, menu });
}));

router.delete("/menus/:id", requirePermission("blogs", "delete"), asyncHandler(async (req, res) => {
  await prisma.menu.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}));

module.exports = router;
