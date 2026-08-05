const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const prisma = require("../lib/prisma");

// Requires a valid admin access token. Attaches req.admin = { id, role }.
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, "Missing admin token"));

  try {
    const payload = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    if (payload.type !== "admin") return next(new ApiError(401, "Invalid token type"));
    req.admin = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(new ApiError(401, "Invalid or expired admin token"));
  }
}

// SUPER_ADMIN always passes. Otherwise checks the admin has an explicit
// Permission row for {module, action}. Use after requireAdmin.
function requirePermission(module, action) {
  return async (req, res, next) => {
    try {
      if (req.admin.role === "SUPER_ADMIN") return next();

      const has = await prisma.adminPermission.findFirst({
        where: {
          adminId: req.admin.id,
          permission: { module, action },
        },
      });

      if (!has) return next(new ApiError(403, `Forbidden: missing ${module}:${action} permission`));
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Restricts to specific roles regardless of granular permissions (e.g. pharmacist approval)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return next(new ApiError(403, `Forbidden: requires role ${roles.join(" or ")}`));
    }
    next();
  };
}

module.exports = { requireAdmin, requirePermission, requireRole };
