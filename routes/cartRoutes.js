const express = require("express");
const router = express.Router();
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// ======================================================
// 🛒 Add Item to Cart
// ======================================================
router.post("/add", async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || !quantity) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    let cart = await Cart.findOne({ user: userId });
    const product = await Product.findById(productId);

    if (!product)
      return res.status(404).json({ success: false, message: "Product not found" });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId }).populate("items.product");

    res.json({
      success: true,
      message: "Item added to cart successfully",
      cart: updatedCart,
    });
  } catch (err) {
    console.error("❌ Error adding to cart:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================================================
// 📦 Get Cart by User
// ======================================================
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId)
      return res.status(400).json({ success: false, message: "User ID required" });

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart)
      return res.json({ success: true, cart: { items: [] }, message: "Empty cart" });

    res.json({ success: true, cart });
  } catch (err) {
    console.error("❌ Error fetching cart:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================================================
// ✏️ Update Item Quantity
// ======================================================
router.put("/update", async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || quantity == null)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (itemIndex === -1)
      return res.status(404).json({ success: false, message: "Item not found in cart" });

    cart.items[itemIndex].quantity = quantity;

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId }).populate("items.product");

    res.json({ success: true, message: "Cart updated successfully", cart: updatedCart });
  } catch (err) {
    console.error("❌ Error updating cart:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================================================
// 🗑️ Remove Item from Cart
// ======================================================
router.delete("/remove", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId }).populate("items.product");

    res.json({ success: true, message: "Item removed from cart", cart: updatedCart });
  } catch (err) {
    console.error("❌ Error removing item:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ======================================================
// 🧹 Clear Entire Cart (After Payment or Manually)
// ======================================================
router.delete("/clear/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId)
      return res.status(400).json({ success: false, message: "User ID required" });

    const cart = await Cart.findOne({ user: userId });
    if (!cart)
      return res.status(404).json({ success: false, message: "Cart not found" });

    cart.items = [];
    await cart.save();

    res.json({ success: true, message: "Cart cleared successfully" });
  } catch (err) {
    console.error("❌ Error clearing cart:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
