const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const sgMail = require("@sendgrid/mail");
const passport = require("passport");
const Staff = require("../models/Staff");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * 🔐 GOOGLE STRATEGY
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:5000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value.toLowerCase();

        // 1️⃣ Check Staff collection first
        let staff = await Staff.findOne({ email });
        if (staff) {
          return done(null, {
            _id: staff._id,
            email: staff.email,
            role: "staff",
            name: staff.name || profile.displayName,
          });
        }

        // 2️⃣ Otherwise check User collection
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.findOne({ email });
        }

        if (!user) {
          user = new User({
            googleId: profile.id,
            email,
            role: "user",
            name: profile.displayName,
          });
          await user.save();
        }

        return done(null, {
          _id: user._id,
          email: user.email,
          role: user.role || "user",
          name: user.name || profile.displayName,
        });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

/**
 * ✅ Validation Helpers
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * 🔑 JWT Auth Middleware
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Authorization token missing" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ msg: "Invalid or expired token" });
  }
};

/**
 * 🧭 Admin Only Middleware
 */
const adminMiddleware = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  return res.status(403).json({ msg: "Access denied. Admins only." });
};

/**
 * 📝 REGISTER
 */
router.post("/register", async (req, res) => {
  let { email, password } = req.body;
  email = email?.trim().toLowerCase();

  try {
    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: "Invalid email format" });
    }
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        msg: "Password must be at least 8 characters long and contain uppercase, lowercase, number & special character.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, role: "user" });
    await newUser.save();

    sgMail
      .send({
        to: email,
        from: process.env.FROM_EMAIL,
        subject: "Welcome to Our Service!",
        html: `<p>Hello,</p><p>Thank you for registering with us.</p><p>Best regards,<br/>Your Company Team</p>`,
      })
      .catch((err) => console.error("Email send error:", err));

    res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ msg: "Server error during registration" });
  }
});

/**
 * 🔐 LOGIN (User or Staff)
 */
router.post("/login", async (req, res) => {
  let { email, password } = req.body;
  email = email?.trim().toLowerCase();

  try {
    // User Login
    let user = await User.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch)
        return res.status(400).json({ msg: "Invalid email or password" });

      const role = user.role || "user";
      const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      let redirectPath = "/user";
      if (role === "admin") redirectPath = "/admin";

      return res.json({
        msg: `${role} login successful`,
        token,
        user: { id: user._id, email: user.email, role },
        redirect: redirectPath,
      });
    }

    // Staff Login
    const staff = await Staff.findOne({ email });
    if (!staff)
      return res.status(400).json({ msg: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Invalid email or password" });

    if (staff.status !== "active") {
      return res
        .status(403)
        .json({ msg: "Your account is not active. Contact admin." });
    }

    const token = jwt.sign(
      { id: staff._id, role: "staff" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      msg: "Staff login successful",
      token,
      user: {
        id: staff._id,
        email: staff.email,
        role: "staff",
        name: staff.name,
      },
      redirect: "/staff",
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error during login" });
  }
});

/**
 * 🔁 FORGOT PASSWORD
 */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        msg: "If that email is registered, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    await sgMail.send({
      to: email,
      from: process.env.FROM_EMAIL,
      subject: "Password Reset Request",
      html: `<p>Click here to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    res.json({
      msg: "If that email is registered, a reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ msg: "Server error during forgot password" });
  }
});

/**
 * 🔑 RESET PASSWORD
 */
router.post("/reset-password", async (req, res) => {
  const { token, email, password } = req.body;

  try {
    if (!token || !email || !password) {
      return res.status(400).json({ msg: "Token, email, and password required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ msg: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ msg: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ msg: "Server error during reset password" });
  }
});

/**
 * 🌐 GOOGLE AUTH ROUTES
 */
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  async (req, res) => {
    try {
      // Create JWT
      const token = jwt.sign(
        { id: req.user._id, role: req.user.role || "user" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );

      const user = {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role || "user",
        name: req.user.name,
      };

      const redirectUrl = `${process.env.CLIENT_URL}/google-success?token=${token}&user=${encodeURIComponent(
        JSON.stringify(user)
      )}`;

      res.redirect(redirectUrl);
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${process.env.CLIENT_URL}/login?error=google`);
    }
  }
);

/* ============================================================
   🧑‍💻 USER PROFILE ROUTES (NEW)
============================================================ */

// 📄 Get user profile
router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user)
      return res.status(404).json({ success: false, msg: "User not found" });
    res.json({ success: true, user });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// ✏️ Update user profile
// ✅ Update user profile
router.put("/user/update/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Ensure the logged-in user is updating their own profile
    if (req.user.id !== id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, msg: "Unauthorized action" });
    }

    const { password, ...updates } = req.body;

    if (password && password.trim() !== "") {
      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    if (!updatedUser)
      return res.status(404).json({ success: false, msg: "User not found" });

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, msg: "Server error" });
  }
});

// PUT /auth/user/verify/:id
router.put('/user/verify/:id', async (req, res) => {
  console.log("🟢 VERIFY REQUEST RECEIVED for ID:", req.params.id);
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      console.log("🔴 User not found for ID:", req.params.id);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isVerified = !user.isVerified;
    user.verificationStatus = user.isVerified ? 'verified' : 'not_verified';
    await user.save();

    console.log(`✅ User ${user.email} is now ${user.verificationStatus}`);

    res.json({
      success: true,
      message: `User ${user.isVerified ? 'verified' : 'unverified'} successfully`,
      user,
    });
  } catch (err) {
    console.error('Verify user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /auth/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});
router.get("/users/count", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    res.json({ success: true, totalUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});


module.exports = router;
