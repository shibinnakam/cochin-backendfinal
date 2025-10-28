const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function () {
      // Require password only if the user is not using Google Sign-in
      return !this.googleId;
    },
  },
  googleId: {
    type: String, // Google account ID
    default: null,
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'user'],
    default: 'user', // default role for self-registered users
  },

  // Optional store/user details
  name: {
    type: String,
    required: false,
  },
  phone: {
    type: String,
    required: false,
  },
  pincode: {
    type: String,
    required: false,
  },
  storeName: {
    type: String,
    required: false,
  },
  storeAddress: {
    type: String,
    required: false,
  },
  landmark: {
    type: String,
    required: false,
  },

  // Status fields
  isActive: {
    type: Boolean,
    default: true,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },

  // ✅ Verification fields
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'not_verified'],
    default: 'pending',
  },
  isVerified: {
    type: Boolean,
    default: false, // ✅ Default: user not verified
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,
}, {
  collection: 'users',
  timestamps: true, // adds createdAt & updatedAt
});

module.exports = mongoose.model('User', userSchema);
