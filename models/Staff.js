const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: false }, // will be filled on registration
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // will be set on registration
    gender: { type: String },
    phone: { type: String },
    address: { type: String },
    pincode: { type: String },
    profilePhoto: { type: String },
    role: { type: String, default: "staff" },
    status: { type: String, default: "pending" }, // pending, active, deactivated
    isRegistered: { type: Boolean, default: false }, // after completing registration
    invitedBy: { type: String }, // email or admin id who invited
    dateOfJoining: { type: Date },

    // ✅ Add these two fields for forgot/reset password
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true } // automatically adds createdAt and updatedAt
);

module.exports = mongoose.model("Staff", staffSchema);
