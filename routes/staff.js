const express = require("express");
const router = express.Router();
const Staff = require("../models/Staff");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const { authMiddleware } = require("../middleware/auth");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ================= Multer Config =================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/staff"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + file.fieldname + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error("Only .jpg, .jpeg, .png files are allowed"));
  },
});

// ================= Admin Invites Staff =================
router.post("/invite", async (req, res) => {
  try {
    const { email, invitedBy } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "This email is already registered as a user. Please contact the Person.",
      });
    }

    const existingStaff = await Staff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: "Staff already exists with this email.",
      });
    }

    const staff = new Staff({ email, invitedBy });
    await staff.save();

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "2d" });
    const link = `${process.env.CLIENT_URL}/staff/staffregister?token=${token}`;

    const msg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: "Staff Invitation",
      html: `
        <h2>Welcome!</h2>
        <p>Please complete your registration:</p>
        <a href="${link}" style="padding:10px 20px; background:#007BFF; color:white; text-decoration:none; border-radius:5px;">
          Complete Registration
        </a>
      `,
    };

    await sgMail.send(msg);
    res.json({ success: true, message: "Invitation sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= Staff Registration =================
router.post("/register", upload.single("profilePhoto"), async (req, res) => {
  try {
    const { token, name, address, phone, password, gender, pincode } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    const staff = await Staff.findOne({ email: decoded.email });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    if (staff.isRegistered) {
      return res.status(400).json({
        alreadySubmitted: true,
        message: "You have already submitted your registration",
      });
    }

    // ===== VALIDATIONS =====
    if (!name || !/^[a-zA-Z ]{3,50}$/.test(name))
      return res.status(400).json({ message: "Name must be 3–50 letters only" });

    if (!address || address.length < 5 || address.length > 100)
      return res.status(400).json({ message: "Address must be 5–100 characters" });

    if (!/^[6-9]\d{9}$/.test(phone))
      return res.status(400).json({ message: "Invalid Indian phone number" });

    if (!/^[1-9][0-9]{5}$/.test(pincode))
      return res.status(400).json({ message: "Invalid Indian pincode" });

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!password || !passwordRegex.test(password))
      return res.status(400).json({
        message:
          "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
      });

    const hashedPassword = await bcrypt.hash(password, 10);

    staff.name = name;
    staff.address = address;
    staff.phone = phone;
    staff.password = hashedPassword;
    staff.gender = gender;
    staff.pincode = pincode;
    if (req.file) staff.profilePhoto = `/uploads/staff/${req.file.filename}`;
    staff.status = "pending";
    staff.isRegistered = true;

    await staff.save();

    res.json({
      success: true,
      message: "Registration submitted, awaiting admin approval",
      redirect: "/check-mail",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= Check if Already Submitted =================
router.post("/check-submitted", async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staff = await Staff.findOne({ email: decoded.email });
    if (!staff) return res.json({ submitted: false });

    res.json({ submitted: !!staff.isRegistered });
  } catch {
    res.json({ submitted: false });
  }
});

// ================= Approve Staff =================
router.put("/approve/:id", async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const { joiningDate } = req.body || {};
    staff.status = "active";
    staff.role = "staff";
    staff.dateOfJoining = joiningDate ? new Date(joiningDate) : new Date();

    await staff.save();

    try {
      const msg = {
        to: staff.email,
        from: process.env.FROM_EMAIL,
        subject: "Congratulations! Your application is approved",
        html: `
          <h2>Congratulations ${staff.name || ""}!</h2>
          <p>You are appointed as a worker at <strong>Cochin Distributors, Kattappana</strong>.</p>
          <p>You can use your registered email and password to log in and start working.</p>
          <p>This is your official joining date: <strong>${staff.dateOfJoining.toDateString()}</strong></p>
          <br/>
          <p>Welcome aboard!</p>
          <p><strong>Cochin Distributors Team</strong></p>
        `,
      };
      await sgMail.send(msg);
    } catch (emailErr) {
      console.error("Email failed: ", emailErr.message);
    }

    res.json({ success: true, message: "Staff approved successfully", staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to approve staff" });
  }
});

// ================= Update Staff Status =================
router.put("/status/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "deactivated"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    staff.status = status;
    await staff.save();
    res.json({ success: true, message: `Staff ${status}`, staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= Get Logged-in Staff Profile =================
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const staff = await Staff.findById(req.user.id).select("-password");
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ success: true, staff });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ================= Update Profile =================
// Update profile including password change
router.put("/update", authMiddleware, upload.single("profilePhoto"), async (req, res) => {
  try {
    let staff = await Staff.findById(req.user.id);
    let userFallback = false;

    if (!staff) {
      staff = await User.findById(req.user.id);
      if (!staff) return res.status(404).json({ success: false, errors: [{ field: "username", message: "User not found" }] });
      userFallback = true;
    }

    const { currentPassword, newPassword, name, address, phone, gender, pincode } = req.body;
    const updates = {};

    if (req.file) updates.profilePhoto = `/uploads/staff/${req.file.filename}`;

    if (name && !/^[a-zA-Z ]{3,50}$/.test(name)) {
      return res.status(400).json({ errors: [{ field: "username", message: "Name must be 3–50 letters." }] });
    } else if (name) updates.name = name.trim();

    if (address && (address.length < 5 || address.length > 100)) {
      return res.status(400).json({ errors: [{ field: "address", message: "Address must be 5–100 characters." }] });
    } else if (address) updates.address = address.trim();

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ errors: [{ field: "phone", message: "Phone must be 10 digits starting with 6–9." }] });
    } else if (phone) updates.phone = phone.trim();

    if (gender) updates.gender = gender.trim();

    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
      return res.status(400).json({ errors: [{ field: "pincode", message: "Invalid pincode format." }] });
    } else if (pincode) updates.pincode = pincode.trim();

    // Password change
    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          errors: [{ field: "currentPassword", message: "Both current and new passwords are required" }]
        });
      }

      const isMatch = await bcrypt.compare(currentPassword.trim(), staff.password);
      if (!isMatch) {
        return res.status(400).json({
          errors: [{ field: "currentPassword", message: "Current password is invalid" }]
        });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          errors: [{ field: "newPassword", message: "New password must be at least 8 characters, include uppercase, lowercase, number, and special character" }]
        });
      }

      updates.password = await bcrypt.hash(newPassword, 10);
    }

    const model = userFallback ? User : Staff;
    const updatedStaff = await model
      .findByIdAndUpdate(req.user.id, updates, { new: true })
      .select("-password");

    res.json({ success: true, message: "Profile updated successfully", staff: updatedStaff });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({
      success: false,
      errors: [{ field: "username", message: err.message }]
    });
  }
});
// ================= Get All Staff =================
router.get("/", async (req, res) => {
  try {
    const staff = await Staff.find().sort({ createdAt: -1 });
    res.json({ success: true, staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= Delete Staff =================
router.delete("/:id", async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });

    await Staff.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Staff deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= Total Staff Count =================
router.get("/totalstaff", async (req, res) => {
  try {
    const totalStaff = await Staff.countDocuments();
    res.json({ success: true, total: totalStaff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
// ================= Staff Stats =================
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const totalItems = await Staff.countDocuments(); // Example
    const leavesTaken = 5; // Replace with actual leave logic
    const pendingTasks = 3; // Replace with actual task logic
    const completedTasks = 7; // Replace with actual task logic

    res.json({ totalItems, leavesTaken, pendingTasks, completedTasks });
  } catch (err) {
    console.error("Error fetching staff stats:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});


module.exports = router;
