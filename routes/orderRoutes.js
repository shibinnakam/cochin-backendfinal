const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Orders");
const Cart = require("../models/Cart");
require("dotenv").config();

const router = express.Router();

// ✅ Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

// ------------------------------
// 🧾 Create Razorpay order (for online payment)
// ------------------------------
router.post("/create", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount missing" });
    }

    const options = {
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Razorpay Order Error:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

// ------------------------------
// ✅ Verify Razorpay payment
// ------------------------------
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.json({ success: true, message: "Payment verified successfully" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ------------------------------
// 🛒 Place order (from cart)
// ------------------------------
router.post("/place/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentMethod, paymentId } = req.body;

    // ✅ Fetch user's cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // ✅ Prepare order items
    const items = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.discountPrice,
    }));

    // ✅ Calculate total amount
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // ✅ Create new order document
    const order = new Order({
      user: userId,
      items,
      totalAmount,
      paymentMethod: paymentMethod || "COD",
      paymentId: paymentId || null,
      status: paymentMethod === "Online" ? "Paid" : "Pending",
      createdAt: new Date(),
    });

    await order.save();

    // ✅ Clear user's cart
    await Cart.findOneAndDelete({ user: userId });

    res.json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (err) {
    console.error("❌ Order Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ------------------------------
// 📦 Get all orders of a user
// ------------------------------
router.get("/:userId", async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
