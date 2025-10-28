const express = require("express");
const router = express.Router();
const Resignation = require("../models/Resignation");
const Staff = require("../models/Staff");
const sgMail = require("@sendgrid/mail");

// ==========================
// ✅ Setup SendGrid
// ==========================
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ======================================================
// 1️⃣ Staff Apply for Resignation (Public for now)
// ======================================================
router.post("/apply", async (req, res) => {
  try {
    const { reason, staffId } = req.body;

    // Basic validation
    if (!reason || !staffId) {
      return res
        .status(400)
        .json({ message: "Reason and staffId are required." });
    }

    // Validate staff exists
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found." });
    }

    // Save resignation
    const resignation = new Resignation({ staffId, reason });
    await resignation.save();

    res.json({ message: "Resignation applied successfully." });
  } catch (err) {
    console.error("❌ Error applying resignation:", err.message);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// ======================================================
// 2️⃣ Admin Get All Resignations (Public for now)
// ======================================================
router.get("/all", async (req, res) => {
  try {
    const resignations = await Resignation.find()
      .populate("staffId", "name email dateOfJoining")
      .sort({ createdAt: -1 });

    res.json(resignations);
  } catch (error) {
    console.error("❌ Error fetching resignations:", error.message);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// ======================================================
// 3️⃣ Admin Approve or Reject a Resignation
// ======================================================
router.put("/:id/decision", async (req, res) => {
  try {
    const { status, adminComment } = req.body;

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    // Find resignation and staff details
    const resignation = await Resignation.findById(req.params.id).populate("staffId");
    if (!resignation) {
      return res.status(404).json({ message: "Resignation not found." });
    }

    // Update resignation details
    resignation.status = status;
    resignation.processedAt = new Date();
    resignation.adminComment = adminComment || "";
    await resignation.save();

    // Deactivate staff if approved
    if (status === "approved") {
      await Staff.findByIdAndUpdate(resignation.staffId._id, {
        status: "deactivated",
      });
    }

    // ================================
    // ✅ Email Notification (SendGrid)
    // ================================
    const emailHTML = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #333;">Resignation Update</h2>
        <p>Dear ${resignation.staffId.name},</p>
        <p>Your resignation request has been 
          <b style="color: ${status === "approved" ? "green" : "red"};">
            ${status.toUpperCase()}
          </b>.
        </p>
        ${
          adminComment
            ? `<p><b>Admin Comment:</b> ${adminComment}</p>`
            : ""
        }
        <p>Thank you for your service to our organization.</p>
        <hr/>
        <p style="font-size: 13px; color: #888;">HR Department, CochinD</p>
      </div>
    `;

    const msg = {
      to: resignation.staffId.email,
      from: process.env.FROM_EMAIL,
      subject:
        status === "approved"
          ? "Your Resignation Has Been Approved"
          : "Your Resignation Has Been Rejected",
      html: emailHTML,
    };

    try {
      await sgMail.send(msg);
      console.log(`📧 Email sent to ${resignation.staffId.email}`);
    } catch (emailErr) {
      console.warn("⚠️ Email send failed:", emailErr.message);
    }

    res.json({
      message: `Resignation ${status} successfully.`,
      resignation,
    });
  } catch (error) {
    console.error("❌ Error processing resignation:", error.message);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

module.exports = router;
