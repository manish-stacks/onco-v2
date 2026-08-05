const express = require("express");
const prisma = require("../lib/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();
router.use(requireAuth);

// POST /api/prescriptions - upload a prescription image/PDF, goes to PENDING for pharmacist review
router.post(
  "/",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "File is required");

    const prescription = await prisma.prescription.create({
      data: {
        userId: req.userId,
        fileUrl: `/uploads/${req.file.filename}`,
        doctorName: req.body.doctorName || null,
        patientName: req.body.patientName || null,
      },
    });

    res.status(201).json({ success: true, prescription });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const prescriptions = await prisma.prescription.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, prescriptions });
  })
);

module.exports = router;
