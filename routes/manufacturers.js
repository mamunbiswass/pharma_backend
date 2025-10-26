const express = require("express");
const router = express.Router();
const db = require("../db"); // আপনার mysql2/promise db connection

// 🔹 Get all manufacturers
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM manufacturers ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("Fetch manufacturers error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// 🔹 Add new manufacturer
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Manufacturer name is required" });
  }

  try {
    // ✅ Duplicate check
    const [exists] = await db.query("SELECT id FROM manufacturers WHERE name = ?", [name.trim()]);
    if (exists.length > 0) {
      return res.status(409).json({ error: "Manufacturer already exists" });
    }

    const [result] = await db.query("INSERT INTO manufacturers (name) VALUES (?)", [name.trim()]);
    res.json({ id: result.insertId, name: name.trim() });
  } catch (err) {
    console.error("Add manufacturer error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// 🔹 Update manufacturer
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Manufacturer name is required" });
  }

  try {
    // ✅ Duplicate check (excluding current ID)
    const [exists] = await db.query(
      "SELECT id FROM manufacturers WHERE name = ? AND id != ?",
      [name.trim(), id]
    );
    if (exists.length > 0) {
      return res.status(409).json({ error: "Manufacturer already exists" });
    }

    const [result] = await db.query("UPDATE manufacturers SET name = ? WHERE id = ?", [name.trim(), id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Manufacturer not found" });
    }

    res.json({ id, name: name.trim() });
  } catch (err) {
    console.error("Update manufacturer error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// 🔹 Delete manufacturer
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("DELETE FROM manufacturers WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Manufacturer not found" });
    }

    res.json({ message: "Manufacturer deleted successfully" });
  } catch (err) {
    console.error("Delete manufacturer error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// for new invoice

router.get("/search", async (req, res) => {
  try {
    const { q = "" } = req.query;
    if (!q.trim()) return res.json([]);

    const [rows] = await db.query(
      `SELECT id, name, pack_size, hsn_code, gst_rate, sale_price, mrp_price
       FROM product_master
       WHERE name LIKE ?
       ORDER BY name ASC
       LIMIT 20`,
      [`%${q}%`]
    );

    res.json(rows);
  } catch (err) {
    console.error("Product search error:", err);
    res.status(500).json({ error: "Database error" });
  }
});


module.exports = router;
