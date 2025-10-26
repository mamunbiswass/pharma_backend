const express = require("express");
const router = express.Router();
const db = require("../db"); // mysql2/promise pool connection

/* ============================================================
 🏪 All routes are now SHOP-SPECIFIC (Multi-Shop Supported)
 Each supplier record belongs to a specific shop_id.
============================================================ */

// ===============================
// GET all suppliers (Shop-wise)
// ===============================
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1; // Default shop for testing
    const [rows] = await db.query(
      `SELECT id, name, phone, email, address, gst, drug_license, created_at
       FROM suppliers
       WHERE shop_id = ?
       ORDER BY id DESC`,
      [shop_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch suppliers error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===============================
// ADD new supplier (Shop-wise)
// ===============================
router.post("/", async (req, res) => {
  const shop_id = req.shop_id || 1;
  const { name, phone, email, address, gst, drug_license } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Name and Phone are required" });
  }

  try {
    // Prevent duplicate supplier name/phone for same shop
    const [dup] = await db.query(
      `SELECT id FROM suppliers WHERE (name = ? OR phone = ?) AND shop_id = ? LIMIT 1`,
      [name, phone, shop_id]
    );
    if (dup.length > 0) {
      return res.status(400).json({ error: "Supplier already exists for this shop" });
    }

    const [result] = await db.query(
      `INSERT INTO suppliers (shop_id, name, phone, email, address, gst, drug_license, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [shop_id, name, phone, email, address, gst, drug_license]
    );

    res.json({
      success: true,
      id: result.insertId,
      shop_id,
      name,
      phone,
      email,
      address,
      gst,
      drug_license,
    });
  } catch (err) {
    console.error("❌ Add supplier error:", err);
    res.status(500).json({ error: "Failed to add supplier" });
  }
});

// ===============================
// UPDATE supplier (Shop-wise)
// ===============================
router.put("/:id", async (req, res) => {
  const shop_id = req.shop_id || 1;
  const id = req.params.id;
  const { name, phone, email, address, gst, drug_license } = req.body;

  try {
    const [exist] = await db.query(
      `SELECT id FROM suppliers WHERE id = ? AND shop_id = ? LIMIT 1`,
      [id, shop_id]
    );
    if (exist.length === 0) {
      return res.status(404).json({ error: "Supplier not found for this shop" });
    }

    await db.query(
      `UPDATE suppliers 
       SET name=?, phone=?, email=?, address=?, gst=?, drug_license=?, updated_at=NOW()
       WHERE id=? AND shop_id=?`,
      [name, phone, email, address, gst, drug_license, id, shop_id]
    );

    res.json({ success: true, message: "Supplier updated successfully" });
  } catch (err) {
    console.error("❌ Update supplier error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===============================
// DELETE supplier (Shop-wise)
// ===============================
router.delete("/:id", async (req, res) => {
  const shop_id = req.shop_id || 1;
  const id = req.params.id;

  try {
    const [result] = await db.query(
      `DELETE FROM suppliers WHERE id = ? AND shop_id = ?`,
      [id, shop_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Supplier not found for this shop" });
    }

    res.json({ success: true, message: "Supplier deleted successfully" });
  } catch (err) {
    console.error("❌ Delete supplier error:", err);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});

module.exports = router;
