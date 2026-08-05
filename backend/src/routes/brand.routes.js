const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, logoUrl: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, brands });
  })
);

router.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({ where: { slug: req.params.slug } });
    if (!brand || !brand.isActive) throw new ApiError(404, "Brand not found");
    res.json({ success: true, brand });
  })
);

module.exports = router;
