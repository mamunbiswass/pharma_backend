const express = require("express");
const router = express.Router();
const db = require("../db");

/* ======================================
 📦 1️⃣ FETCH ALL CURRENT STOCK (Product-wise, Shop-wise)
====================================== */
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1; // 🏪 Default Biswas Medicine
    const [rows] = await db.query(
      `
      SELECT 
        pm.id AS medicine_id,
        pm.name AS product_name,
        pm.hsn_code AS hsn,
        pm.gst_rate AS gst,
        pm.purchase_price AS purchase_rate,
        pm.mrp_price AS mrp,
        pm.stock AS qty
      FROM product_master pm
      WHERE pm.shop_id = ?
      ORDER BY pm.name ASC
      `,
      [shop_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Current Stock Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch current stock" });
  }
});

/* ======================================
 📦 2️⃣ FETCH BATCH LIST FOR SPECIFIC MEDICINE (Shop-wise)
====================================== */
router.get("/batches/:medicine_id", async (req, res) => {
  const { medicine_id } = req.params;
  const shop_id = req.shop_id || 1;

  try {
    // 🔹 1. Try to fetch from purchase_items table
    const [rows] = await db.query(
      `
      SELECT 
        pi.batch_no,
        pi.expiry_date,
        (pi.quantity - pi.sold_qty) AS available_qty,
        pi.purchase_rate,
        pi.mrp,
        pm.pack_size AS pack,
        pm.hsn_code AS hsn,
        pm.gst_rate
      FROM purchase_items pi
      LEFT JOIN product_master pm ON pm.id = pi.medicine_id
      WHERE pi.medicine_id = ? 
        AND pi.shop_id = ?
        AND (pi.quantity - pi.sold_qty) > 0
        AND (pi.expiry_date IS NULL OR pi.expiry_date >= CURDATE())
      ORDER BY pi.expiry_date ASC
      `,
      [medicine_id, shop_id]
    );

    // 🔹 2. If batch stock found → return it
    if (rows.length > 0) {
      const formatted = rows.map((r) => ({
        batch_no: r.batch_no,
        expiry_date:
          r.expiry_date && r.expiry_date !== "0000-00-00"
            ? r.expiry_date
            : null,
        available_qty: Number(r.available_qty) || 0,
        purchase_rate: Number(r.purchase_rate) || 0,
        mrp: Number(r.mrp) || 0,
        pack: r.pack || "-",
        hsn: r.hsn || "-",
        gst_rate: Number(r.gst_rate) || 0,
      }));
      return res.json(formatted);
    }

    // 🔹 3. If no batch found → fallback to product_master stock
    const [fallback] = await db.query(
      `
      SELECT 
        id AS medicine_id,
        name AS product_name,
        hsn_code AS hsn,
        gst_rate,
        purchase_price AS purchase_rate,
        mrp_price AS mrp,
        stock AS available_qty,
        pack_size AS pack
      FROM product_master
      WHERE id = ? AND shop_id = ? AND stock > 0
      `,
      [medicine_id, shop_id]
    );

    if (fallback.length > 0) {
      const f = fallback[0];
      return res.json([
        {
          batch_no: "-",
          expiry_date: null,
          available_qty: Number(f.available_qty) || 0,
          purchase_rate: Number(f.purchase_rate) || 0,
          mrp: Number(f.mrp) || 0,
          pack: f.pack || "-",
          hsn: f.hsn || "-",
          gst_rate: Number(f.gst_rate) || 0,
        },
      ]);
    }

    // 🔹 4. If neither batch nor stock → empty result
    res.json([]);
  } catch (err) {
    console.error("🔴 Fetch batch stock error:", err);
    res.status(500).json({ error: "Failed to fetch stock batches" });
  }
});

/* ======================================
 🔄 3️⃣ UPDATE STOCK AFTER SALE (Shop-wise)
====================================== */
async function updateStockAfterSale(conn, shop_id, items) {
  try {
    for (const it of items) {
      let remaining = Number(it.quantity);

      // 🔹 Fetch available batches for this medicine
      const [batches] = await conn.query(
        `
        SELECT id, quantity, sold_qty 
        FROM purchase_items 
        WHERE shop_id = ? AND medicine_id = ? AND (quantity - sold_qty) > 0
        ORDER BY expiry_date ASC
        `,
        [shop_id, it.medicine_id]
      );

      // 🔹 Deduct sold quantity batch-wise
      for (const b of batches) {
        const available = b.quantity - b.sold_qty;
        const useQty = Math.min(available, remaining);

        if (useQty > 0) {
          await conn.query(
            `UPDATE purchase_items 
             SET sold_qty = sold_qty + ? 
             WHERE id = ? AND shop_id = ?`,
            [useQty, b.id, shop_id]
          );

          remaining -= useQty;
        }

        if (remaining <= 0) break;
      }

      // 🔹 Fallback: reduce main product stock too
      await conn.query(
        `UPDATE product_master 
         SET stock = GREATEST(stock - ?, 0)
         WHERE id = ? AND shop_id = ?`,
        [it.quantity, it.medicine_id, shop_id]
      );
    }
  } catch (err) {
    console.error("❌ updateStockAfterSale error:", err);
    throw err;
  }
}

/* ======================================
 📊 4️⃣ CHECK AVAILABLE STOCK FOR BATCH (Shop-wise)
====================================== */
router.get("/check/:medicine_id/:batch_no", async (req, res) => {
  const { medicine_id, batch_no } = req.params;
  const shop_id = req.shop_id || 1;

  try {
    const [rows] = await db.query(
      `
      SELECT (quantity - sold_qty) AS available 
      FROM purchase_items 
      WHERE medicine_id = ? AND shop_id = ? AND batch_no = ? 
      LIMIT 1
      `,
      [medicine_id, shop_id, batch_no]
    );

    res.json({ available: rows[0]?.available || 0 });
  } catch (err) {
    console.error("❌ Stock check error:", err);
    res.status(500).json({ available: 0 });
  }
});

module.exports = router;
module.exports.updateStockAfterSale = updateStockAfterSale;
