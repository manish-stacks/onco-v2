const express = require("express");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { sendTemplatedEmail } = require("../utils/notify");

const router = express.Router();

// GET /api/content/banners?placement=HOME_HERO
router.get(
  "/banners",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        ...(req.query.placement ? { placement: req.query.placement } : {}),
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      orderBy: { sortOrder: "asc" },
    });
    // filter endsAt in JS since Prisma OR/AND nesting for "endsAt null or future" alongside startsAt gets awkward
    res.json({ success: true, banners: banners.filter((b) => !b.endsAt || b.endsAt >= now) });
  })
);

router.get(
  "/sliders",
  asyncHandler(async (req, res) => {
    const sliders = await prisma.slider.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    res.json({ success: true, sliders });
  })
);

router.get(
  "/testimonials",
  asyncHandler(async (req, res) => {
    const testimonials = await prisma.testimonial.findMany({ where: { isApproved: true }, orderBy: { createdAt: "desc" }, take: 12 });
    res.json({ success: true, testimonials });
  })
);

router.get(
  "/faqs",
  asyncHandler(async (req, res) => {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true, ...(req.query.category ? { category: req.query.category } : {}) },
      orderBy: { sortOrder: "asc" },
    });
    res.json({ success: true, faqs });
  })
);

router.get(
  "/menus",
  asyncHandler(async (req, res) => {
    const all = await prisma.menu.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    const byId = new Map(all.map((m) => [m.id, { ...m, children: [] }]));
    const roots = [];
    for (const m of byId.values()) {
      if (m.parentId && byId.has(m.parentId)) byId.get(m.parentId).children.push(m);
      else roots.push(m);
    }
    res.json({ success: true, menus: roots });
  })
);

// POST /api/content/contact - contact form submission
router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().optional(),
      subject: z.string().optional(),
      message: z.string().min(5),
    });
    const data = schema.parse(req.body);

    const enquiry = await prisma.contactEnquiry.create({ data });
    sendTemplatedEmail(
      data.email,
      "CONTACT_AUTOREPLY",
      { name: data.name },
      { subject: "We received your message", html: "<p>Hi {{name}}, thanks for reaching out. Our team will respond shortly.</p>" }
    ).catch(() => {});

    res.status(201).json({ success: true, enquiry, message: "Thanks! We'll get back to you soon." });
  })
);

module.exports = router;
