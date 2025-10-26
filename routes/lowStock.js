// routes/lowStock.js
const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ Low Stock API
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        pm.id AS product_id,
        pm.name AS product_name,
        pm.hsn_code,
        pm.gst_rate,
        pm.stock,
        pm.purchase_price,
        pm.mrp_price,
        (
          SELECT DATE_FORMAT(MIN(pi.expiry_date), "%m/%y")
          FROM purchase_items pi
          WHERE pi.medicine_id = pm.id
        ) AS expiry
      FROM product_master pm
      WHERE pm.stock <= 10
      ORDER BY pm.stock ASC
    `);

    const formatted = rows.map((r) => ({
      id: r.product_id,
      name: r.product_name,
      hsn: r.hsn_code || "-",
      gst: Number(r.gst_rate || 0),
      stock: Number(r.stock || 0),
      purchase_rate: Number(r.purchase_price || 0),
      mrp: Number(r.mrp_price || 0),
      expiry: r.expiry || "—",
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Low Stock fetch error:", err);
    res.status(500).json({ error: "Failed to fetch low stock" });
  }
});

module.exports = router;
