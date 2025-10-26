// routes/currentStock.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/* ==========================================
 📦 CURRENT STOCK — Shared Products + Shop Stock
========================================== */
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id;
    if (!shop_id)
      return res.status(400).json({ error: "Missing shop_id in request" });

    // 🔹 JOIN product_master + shop_products
    const [rows] = await db.query(
      `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        IFNULL(p.hsn_code, '-') AS hsn,
        IFNULL(p.gst_rate, 0) AS gst,
        IFNULL(sp.stock, 0) AS qty,
        IFNULL(sp.purchase_rate, 0) AS purchase_rate,
        IFNULL(sp.mrp, 0) AS mrp,
        sp.last_updated
      FROM product_master p
      LEFT JOIN shop_products sp 
        ON sp.product_id = p.id AND sp.shop_id = ?
      ORDER BY p.name ASC
      `,
      [shop_id]
    );

    const formatted = rows.map((r) => ({
      id: r.product_id,
      name: r.product_name || "-",
      hsn: r.hsn || "-",
      gst: Number(r.gst) || 0,
      qty: Number(r.qty) || 0,
      purchase_rate: Number(r.purchase_rate) || 0,
      mrp: Number(r.mrp) || 0,
      last_updated: r.last_updated || null,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("❌ Current Stock fetch error:", err);
    res.status(500).json({ error: "Failed to fetch current stock" });
  }
});

/* ==========================================
 🧾 REFRESH STOCK FOR NEW PRODUCT
 (When new product is added to master list)
========================================== */
router.post("/sync-products", async (req, res) => {
  try {
    const shop_id = req.shop_id;
    if (!shop_id)
      return res.status(400).json({ error: "Missing shop_id in request" });

    // 🔹 Find products not yet added in shop_products
    const [missing] = await db.query(
      `
      SELECT p.id FROM product_master p
      WHERE p.id NOT IN (
        SELECT product_id FROM shop_products WHERE shop_id = ?
      )
      `,
      [shop_id]
    );

    if (missing.length === 0)
      return res.json({ message: "✅ All products already synced" });

    // 🔹 Insert missing records with default stock = 0
    const values = missing.map((m) => [shop_id, m.id, 0]);
    await db.query(
      "INSERT INTO shop_products (shop_id, product_id, stock) VALUES ?",
      [values]
    );

    res.json({
      success: true,
      message: `✅ ${missing.length} product(s) synced successfully.`,
    });
  } catch (err) {
    console.error("❌ Product Sync Error:", err);
    res.status(500).json({ error: "Failed to sync products" });
  }
});

module.exports = router;
