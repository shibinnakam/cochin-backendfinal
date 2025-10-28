const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Staff email is required"],
    lowercase: true,
    trim: true,
  },
  reason: {
    type: String,
    required: [true, "Leave reason is required"],
    trim: true,
    minlength: [5, "Reason must be at least 5 characters"],
    maxlength: [200, "Reason cannot exceed 200 characters"],
  },
  date: {
    type: Date,
    required: [true, "Leave date is required"],
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  approvedDate: {
    type: Date,
    default: null,
  },
  rejectedDate: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to auto-update `updatedAt` on save
leaveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// ✅ Export the model, check if it exists
module.exports = mongoose.models.Leave || mongoose.model('Leave', leaveSchema);
