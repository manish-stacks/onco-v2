require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow serving /uploads images cross-origin to the frontend
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// serve uploaded prescription/product images
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// basic rate limiting on auth/OTP endpoints to slow down brute force / spam
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth", authLimiter);

app.get("/api/health", (req, res) => res.json({ success: true, message: "Onco Health Mart API running" }));

// ---------- Public / customer-facing routes ----------
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/cart", require("./routes/cart.routes"));
app.use("/api/wishlist", require("./routes/wishlist.routes"));
app.use("/api/addresses", require("./routes/address.routes"));
app.use("/api/coupons", require("./routes/coupon.routes"));
app.use("/api/prescriptions", require("./routes/prescription.routes"));
app.use("/api/orders", require("./routes/order.routes"));
app.use("/api/blog", require("./routes/blog.routes"));
app.use("/api/pages", require("./routes/cms.routes"));
app.use("/api/content", require("./routes/content.routes"));
app.use("/api/support-tickets", require("./routes/support.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/wallet", require("./routes/wallet.routes"));

// ---------- Admin routes ----------
app.use("/api/admin/auth", require("./routes/admin/admin.auth.routes"));
app.use("/api/admin/products", require("./routes/admin/admin.product.routes"));
app.use("/api/admin/categories", require("./routes/admin/admin.category.routes"));
app.use("/api/admin/orders", require("./routes/admin/admin.order.routes"));
app.use("/api/admin/dashboard", require("./routes/admin/admin.dashboard.routes"));
app.use("/api/admin/blog", require("./routes/admin/admin.blog.routes"));
app.use("/api/admin/pages", require("./routes/admin/admin.cms.routes"));
app.use("/api/admin/content", require("./routes/admin/admin.content.routes"));
app.use("/api/admin/coupons", require("./routes/admin/admin.coupon.routes"));
app.use("/api/admin/support-tickets", require("./routes/admin/admin.support.routes"));
app.use("/api/admin/inventory", require("./routes/admin/admin.inventory.routes"));
app.use("/api/admin/users", require("./routes/admin/admin.user.routes"));
app.use("/api/admin/templates", require("./routes/admin/admin.template.routes"));

app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Onco Health Mart API listening on port ${PORT}`));
