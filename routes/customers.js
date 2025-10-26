const express = require("express");
const router = express.Router();
const db = require("../db"); // mysql2/promise pool

/* =====================================================
 🏪 1️⃣ GET ALL CUSTOMERS (Shop-wise)
===================================================== */
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1; // current shop
    const [rows] = await db.query(
      `SELECT id, name, phone, email, address, gst_no, drug_license, created_at
       FROM customers
       WHERE shop_id = ?
       ORDER BY id DESC`,
      [shop_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch customers error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* =====================================================
 🏪 2️⃣ ADD NEW CUSTOMER (Shop-wise)
===================================================== */
router.post("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const { name, phone, email, address, gst_no, drug_license } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and Phone are required" });
    }

    // 🔹 Check duplicate (shop-wise)
    const [dup] = await db.query(
      `SELECT id FROM customers 
       WHERE shop_id = ? AND (phone = ? OR gst_no = ? OR drug_license = ?)`,
      [shop_id, phone, gst_no, drug_license]
    );
    if (dup.length > 0) {
      return res.status(400).json({ error: "Duplicate entry not allowed" });
    }

    // 🔹 Insert new customer
    const [result] = await db.query(
      `INSERT INTO customers 
       (shop_id, name, phone, email, address, gst_no, drug_license, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        shop_id,
        name,
        phone,
        email || null,
        address || null,
        gst_no?.toUpperCase() || null,
        drug_license?.toUpperCase() || null,
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      name,
      phone,
      email,
      address,
      gst_no,
      drug_license,
    });
  } catch (err) {
    console.error("❌ Insert customer error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* =====================================================
 🏪 3️⃣ UPDATE CUSTOMER (Shop-wise)
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const { id } = req.params;
    const { name, phone, email, address, gst_no, drug_license } = req.body;

    // 🔹 Check duplicate ignoring current ID (shop-wise)
    const [dup] = await db.query(
      `SELECT id FROM customers 
       WHERE shop_id = ? 
       AND (phone = ? OR gst_no = ? OR drug_license = ?)
       AND id <> ?`,
      [shop_id, phone, gst_no, drug_license, id]
    );
    if (dup.length > 0) {
      return res.status(400).json({ error: "Duplicate entry not allowed" });
    }

    // 🔹 Update customer
    const [result] = await db.query(
      `UPDATE customers SET 
         name = ?, phone = ?, email = ?, address = ?, gst_no = ?, drug_license = ?
       WHERE id = ? AND shop_id = ?`,
      [
        name,
        phone,
        email || null,
        address || null,
        gst_no?.toUpperCase() || null,
        drug_license?.toUpperCase() || null,
        id,
        shop_id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ success: true, message: "✅ Customer updated successfully" });
  } catch (err) {
    console.error("❌ Update customer error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* =====================================================
 🏪 4️⃣ DELETE CUSTOMER (Shop-wise)
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const { id } = req.params;

    const [result] = await db.query(
      `DELETE FROM customers WHERE id = ? AND shop_id = ?`,
      [id, shop_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ success: true, message: "✅ Customer deleted successfully" });
  } catch (err) {
    console.error("❌ Delete customer error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
