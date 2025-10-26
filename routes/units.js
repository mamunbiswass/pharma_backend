const express = require("express");
const router = express.Router();
const db = require("../db"); // mysql2/promise pool

// ✅ Get all units
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM units ORDER BY id ASC");
    res.json(rows);
  } catch (err) {
    console.error("Fetch units error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Add new unit
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Unit name is required" });

  try {
    const [result] = await db.query("INSERT INTO units (name) VALUES (?)", [name.trim()]);
    res.json({ id: result.insertId, name });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Unit already exists" });
    }
    console.error("Add unit error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Update unit
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Unit name is required" });

  try {
    const [result] = await db.query("UPDATE units SET name = ? WHERE id = ?", [name.trim(), id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Unit not found" });
    res.json({ id, name });
  } catch (err) {
    console.error("Update unit error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Delete unit
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("DELETE FROM units WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Unit not found" });
    res.json({ message: "Unit deleted successfully" });
  } catch (err) {
    console.error("Delete unit error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
