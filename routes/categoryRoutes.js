const express = require("express");
const router = express.Router();
const Category = require("../models/Category");

// Validation function
function validateCategoryName(name) {
  // Allow only alphabets (A-Z, a-z) and spaces
  const regex = /^[A-Za-z\s]+$/;

  if (!name || !name.trim()) {
    return "Category name is required";
  }
  if (name.trim().length < 4) {
    return "Category name must be at least 4 characters long";
  }
  if (!regex.test(name.trim())) {
    return "Category name can only contain letters and spaces";
  }

  return null; // ✅ No validation errors
}

// ➕ Add new category
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;

    // Run validation
    const errorMsg = validateCategoryName(name);
    if (errorMsg) {
      return res.status(400).json({ error: errorMsg });
    }

    // Check for duplicates (case-insensitive)
    const existing = await Category.findOne({
      name: new RegExp("^" + name.trim() + "$", "i"),
    });
    if (existing) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const category = new Category({ name: name.trim() });
    await category.save();

    res.status(201).json(category);
  } catch (err) {
    console.error("Error adding category:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// 📋 Get all categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ updatedAt: -1 });
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ✏️ Update category
router.put("/:id", async (req, res) => {
  try {
    const { name } = req.body;

    // Run validation
    const errorMsg = validateCategoryName(name);
    if (errorMsg) {
      return res.status(400).json({ error: errorMsg });
    }

    // Check if another category with same name exists
    const existing = await Category.findOne({
      name: new RegExp("^" + name.trim() + "$", "i"),
      _id: { $ne: req.params.id }, // Exclude current category
    });
    if (existing) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Category not found" });

    res.json(updated);
  } catch (err) {
    console.error("Error updating category:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// 🗑️ Delete category
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Category not found" });
    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});
// 📊 Get total categories count
router.get("/totalcategories", async (req, res) => {
  try {
    const total = await Category.countDocuments();
    res.json({ total });
  } catch (err) {
    console.error("Error fetching total categories:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
