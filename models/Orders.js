const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true } // store discountPrice here
      }
    ],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Shipped", "Delivered"], default: "Pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
