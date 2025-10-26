const express = require("express");
const router = express.Router();
const db = require("../db"); // mysql2/promise pool connection

// ==============================
// GET all categories
// ==============================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name FROM categories ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("Fetch categories error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// ADD new category
// ==============================
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const [result] = await db.query("INSERT INTO categories (name) VALUES (?)", [name]);
    res.json({ id: result.insertId, name });
  } catch (err) {
    console.error("Add category error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// UPDATE category
// ==============================
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  try {
    const [result] = await db.query("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ message: "Category updated successfully", id, name });
  } catch (err) {
    console.error("Update category error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// DELETE category
// ==============================
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query("DELETE FROM categories WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
