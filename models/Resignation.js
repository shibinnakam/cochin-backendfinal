const mongoose = require("mongoose");

const resignationSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    reason: { type: String, required: true },
    status: { type: String, default: "pending" }, // pending, approved, rejected
    appliedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    adminComment: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resignation", resignationSchema);
