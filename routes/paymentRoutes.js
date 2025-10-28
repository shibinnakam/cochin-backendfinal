const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const router = express.Router();

// ✅ Create Razorpay order
router.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR" } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount is required" });
    }

    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const options = {
      amount: amount * 100, // convert to paise
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await instance.orders.create(options);
    console.log("✅ Order created:", order);

    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ Error creating order:", err);
    res.status(500).json({ success: false, message: "Error creating Razorpay order" });
  }
});

// ✅ Verify payment signature
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).json({ success: false, message: "Error verifying payment" });
  }
});

module.exports = router;
