const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    originalPrice: { type: Number, required: true },
    discountPrice: { type: Number, required: true },
    image: { type: String, required: true }, // uploaded file name/path
    category: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Category", 
      required: true 
    },
    quantity: { type: Number, required: true, min: 10 },

    // ✅ Newly added fields
    manufacturingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    batchNumber: { type: String, required: true },
    rackNumber: { type: String, required: true },

    // ✅ Status flags
    isExpired: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// 🔹 Auto-update isExpired before saving
productSchema.pre("save", function (next) {
  this.isExpired = this.expiryDate < new Date();
  next();
});

module.exports = mongoose.model("Product", productSchema);
