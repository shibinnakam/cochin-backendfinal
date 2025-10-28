const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Staff = require("../models/Staff");

/**
 * 🔐 Auth Middleware
 * Validates JWT token and attaches the user (or staff) to req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find in User collection
    let account = await User.findById(decoded.id).select("-password");

    // If not found, try Staff collection
    if (!account) {
      account = await Staff.findById(decoded.id).select("-password");
    }

    if (!account) {
      return res.status(401).json({ msg: "Account not found" });
    }

    // ✅ Attach role and basic info to req.user
    req.user = {
      id: account._id,
      email: account.email,
      role: decoded.role || account.role || "user",
      name: account.name || account.email.split("@")[0],
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ msg: "Token is not valid or expired" });
  }
};

/**
 * 🧭 Admin Middleware
 * Ensures the user has the admin role
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
};

/**
 * 👷‍♂️ Staff Middleware (Optional)
 * Ensures the user has the staff role
 */
const staffMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "staff") {
    return res.status(403).json({ msg: "Staff access required" });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, staffMiddleware };
