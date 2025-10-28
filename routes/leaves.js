const express = require("express");
const router = express.Router();
const Leave = require("../models/Leave");

// ----------------------------
// Staff: Request leave
// ----------------------------
router.post("/request", async (req, res) => {
  try {
    const { email, date, reason } = req.body;
    if (!email || !date || !reason)
      return res.status(400).json({ error: "All fields are required" });

    const leave = new Leave({
      email,
      date,
      reason,
      status: "Pending", // default status
    });

    await leave.save();
    res.status(201).json({ message: "Leave request submitted" });
  } catch (err) {
    console.error("Error saving leave:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------
// Staff: Get all leaves for this staff
// ----------------------------
router.get("/my", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const leaves = await Leave.find({ email }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    console.error("Error fetching leave status:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------
// Staff: Get leave stats for dashboard
// ----------------------------
router.get("/stats", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const totalLeaves = await Leave.countDocuments({ email });
    const pendingLeaves = await Leave.countDocuments({ email, status: "Pending" });
    const approvedLeaves = await Leave.countDocuments({ email, status: "Approved" });
    const rejectedLeaves = await Leave.countDocuments({ email, status: "Rejected" });

    res.json({ totalLeaves, pendingLeaves, approvedLeaves, rejectedLeaves });
  } catch (err) {
    console.error("Error fetching leave stats:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------
// Admin: Get all leaves
// ----------------------------
router.get("/all", async (req, res) => {
  try {
    const leaves = await Leave.find().sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    console.error("Error fetching all leaves:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------
// Admin: Update leave status
// ----------------------------
router.patch("/update/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Rejected", "Pending"].includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const updateData = { status };

    if (status === "Approved") {
      updateData.approvedDate = new Date();
      updateData.rejectedDate = null;
    } else if (status === "Rejected") {
      updateData.rejectedDate = new Date();
      updateData.approvedDate = null;
    } else if (status === "Pending") {
      updateData.approvedDate = null;
      updateData.rejectedDate = null;
    }

    const leave = await Leave.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!leave) return res.status(404).json({ error: "Leave not found" });

    res.json(leave);
  } catch (err) {
    console.error("Error updating leave status:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------
// Admin: Delete leave
// ----------------------------
router.delete("/delete/:id", async (req, res) => {
  try {
    const leave = await Leave.findByIdAndDelete(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave not found" });
    res.json({ message: "Leave deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ----------------------------
// Admin: Get total pending leaves count (all staff)
// ----------------------------
router.get("/count/pending", async (req, res) => {
  try {
    const count = await Leave.countDocuments({ status: "Pending" });
    res.json({ totalPending: count });
  } catch (err) {
    console.error("Error fetching pending leave count:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
