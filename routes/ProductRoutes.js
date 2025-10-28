const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Product = require("../models/Product");
const Category = require("../models/Category");

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) cb(null, true);
  else cb(new Error("Only image files are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 2MB
});

// ✅ Add Product
router.post("/addproduct", upload.single("image"), async (req, res) => {
  try {
    const { 
      name, 
      description, 
      originalPrice, 
      discountPrice, 
      category, 
      quantity,
      manufacturingDate,
      expiryDate,
      batchNumber,
      rackNumber
    } = req.body;

    // ---- BASIC VALIDATION ----
    if (
      !name || !description || !originalPrice || !discountPrice ||
      !category || quantity === undefined || !manufacturingDate ||
      !expiryDate || !batchNumber || !rackNumber
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // ✅ Name validation (4–15 chars, only letters/numbers/spaces)
    const nameRegex = /^[A-Za-z0-9 ]{4,15}$/;
    if (!nameRegex.test(name)) {
      return res.status(400).json({
        message: "Product name must be 4–15 characters long and contain only letters, numbers, and spaces"
      });
    }

    // ✅ Description validation (4–20 chars, only letters/numbers/spaces)
    const descRegex = /^[A-Za-z0-9 ]{4,50}$/;
    if (!descRegex.test(description)) {
      return res.status(400).json({
        message: "Description must be 4–50 characters long and contain only letters, numbers, and spaces"
      });
    }

    // ✅ Price validation
    const original = Number(originalPrice);
    const discount = Number(discountPrice);

    if (
      isNaN(original) || isNaN(discount) ||
      original < 1 || original > 1000 ||
      discount < 1 || discount > 1000
    ) {
      return res.status(400).json({
        message: "Prices must be numbers between 1 and 1000"
      });
    }

    if (discount > original) {
      return res.status(400).json({
        message: "Discount price cannot be greater than original price"
      });
    }

    // ✅ Quantity validation
    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({
        message: "Quantity must be a valid number (0 or greater)"
      });
    }

    // ✅ Rack number validation (1–155)
    const rack = Number(rackNumber);
    if (isNaN(rack) || rack < 1 || rack > 155) {
      return res.status(400).json({
        message: "Rack number must be a number between 1 and 155"
      });
    }

    // ✅ Dates validation
    const mfgDate = new Date(manufacturingDate);
    const expDate = new Date(expiryDate);

    if (isNaN(mfgDate.getTime()) || isNaN(expDate.getTime())) {
      return res.status(400).json({ message: "Invalid manufacturing or expiry date" });
    }

    if (mfgDate.getTime() === expDate.getTime()) {
      return res.status(400).json({ message: "Manufacturing date and expiry date cannot be the same" });
    }

    // Expiry must be at least 10 days after manufacturing
    const diffDays = (expDate - mfgDate) / (1000 * 60 * 60 * 24);
    if (diffDays < 10) {
      return res.status(400).json({ message: "Expiry date must be at least 10 days after manufacturing date" });
    }

    // ✅ Batch Number validation (India formats)
    const batchRegex = /^([0-9]{3,10}|[0-9]{6}[A-Z]?|[A-Z]{1,2}[0-9]{4,6}[A-Z0-9]?|L[0-9]{2}[A-Z][0-9]{2})$/;
    if (!batchRegex.test(batchNumber)) {
      return res.status(400).json({
        message: "Invalid batch number format"
      });
    }

    // ✅ Category validation
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: "Invalid category selected" });
    }

    // ✅ Image validation
    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    // ✅ Duplicate check: same name, price, mfg date, expiry date, batch number
    const existingProduct = await Product.findOne({
      name: name.trim(),
      originalPrice: original,
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      batchNumber: batchNumber.trim()
    });

    if (existingProduct) {
      return res.status(400).json({
        message: "Product already uploaded. You can edit it instead."
      });
    }

    // ✅ Create new product
    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      originalPrice: original,
      discountPrice: discount,
      image: `/uploads/${req.file.filename}`,
      category,
      quantity: qty,
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      batchNumber: batchNumber.trim(),
      rackNumber: rack,
      isDeleted: false // default
    });

    await product.save();
    res.status(201).json({ success: true, message: "Product added successfully", product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});




// ✅ Get All Products (with category details)
router.get("/getproduct", async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name") // ✅ show category name instead of ID
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Get Single Product by ID
router.get("/getproduct/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get("/category/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const products = await Product.find({ category: id, isDeleted: false })
      .populate("category", "name"); // optional: get category name

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found for this category" });
    }

    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ Delete Product by ID
router.delete("/deleteproduct/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Delete image file
    if (product.image) {
      const imagePath = path.join(__dirname, "..", product.image.replace(/^\/+/, ""));
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ✅ Update Product by ID
router.put("/updateproduct/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, description, originalPrice, discountPrice, category, quantity } = req.body;

    // Find product
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Update fields (only if provided)
    if (name) product.name = name.trim();
    if (description) product.description = description.trim();
    if (originalPrice) product.originalPrice = Number(originalPrice);
    if (discountPrice) product.discountPrice = Number(discountPrice);
    if (category) product.category = category;
    if (quantity !== undefined) product.quantity = Number(quantity);

    // ✅ If new image uploaded, replace old one
    if (req.file) {
      // delete old image
      if (product.image) {
        const oldImagePath = path.join(__dirname, "..", product.image.replace(/^\/+/, ""));
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
      product.image = `/uploads/${req.file.filename}`;
    }

    await product.save();
    res.status(200).json({ success: true, message: "Product updated successfully", product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ✅ Get Total Product Count
router.get("/totalproducts", async (req, res) => {
  try {
    const count = await Product.countDocuments();
    res.status(200).json({ success: true, total: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
