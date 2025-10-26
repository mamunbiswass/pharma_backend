// routes/returns.js
const express = require("express");
const router = express.Router();
const db = require("../db");

/* ======================================
 🔁 1️⃣ SAVE SALES RETURN (Per Shop)
====================================== */
router.post("/", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const shop_id = req.shop_id; // ✅ from middleware
    const { sale_id, customer_id, date, reason, items, remarks } = req.body;

    if (!shop_id)
      return res.status(400).json({ error: "Missing shop_id in request" });

    if (!items || items.length === 0)
      return res.status(400).json({ error: "No items provided for return" });

    await connection.beginTransaction();

    // 🔹 Insert into returns table
    const [retResult] = await connection.query(
      `INSERT INTO returns 
       (shop_id, return_type, reference_no, customer_id, date, reason, total, remarks, created_at)
       VALUES (?, 'sale', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        shop_id,
        sale_id || null,
        customer_id || null,
        date,
        reason || "",
        items.reduce((sum, it) => sum + Number(it.amount || 0), 0),
        remarks || "",
      ]
    );

    const returnId = retResult.insertId;

    // 🔹 Insert return items
    for (const it of items) {
      await connection.query(
        `INSERT INTO return_items 
         (shop_id, return_id, medicine_id, batch_no, qty, rate, gst, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          shop_id,
          returnId,
          it.medicine_id,
          it.batch_no || "",
          it.qty,
          it.rate,
          it.gst_rate,
          it.amount,
        ]
      );

      // 🔹 Update product_master stock (increase)
      await connection.query(
        `UPDATE product_master 
         SET stock = stock + ? 
         WHERE id = ? AND (shop_id = ? OR shop_id IS NULL)`,
        [it.qty, it.medicine_id, shop_id]
      );

      // 🔹 Reduce sold_qty from purchase_items
      await connection.query(
        `UPDATE purchase_items 
         SET sold_qty = GREATEST(sold_qty - ?, 0)
         WHERE medicine_id = ? AND batch_no = ? AND shop_id = ?
         LIMIT 1`,
        [it.qty, it.medicine_id, it.batch_no, shop_id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Return saved successfully" });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Return Save Error:", err);
    res.status(500).json({ error: err.message || "Failed to save return" });
  } finally {
    connection.release();
  }
});

/* ======================================
 🔁 2️⃣ FETCH ALL RETURNS (Per Shop)
====================================== */
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id;
    if (!shop_id)
      return res.status(400).json({ error: "Missing shop_id in request" });

    const [rows] = await db.query(
      `
      SELECT 
        r.id, 
        r.date, 
        r.return_type, 
        r.reference_no, 
        r.total, 
        r.reason, 
        c.name AS customer_name
      FROM returns r
      LEFT JOIN customers c ON r.customer_id = c.id
      WHERE r.return_type = 'sale' AND r.shop_id = ?
      ORDER BY r.id DESC
      `,
      [shop_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch Returns Error:", err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
});

/* ======================================
 🔁 3️⃣ FETCH SINGLE RETURN DETAILS (Per Shop)
====================================== */
router.get("/:id", async (req, res) => {
  try {
    const shop_id = req.shop_id;
    if (!shop_id)
      return res.status(400).json({ error: "Missing shop_id in request" });

    const [header] = await db.query(
      `SELECT r.*, c.name AS customer_name, c.phone 
       FROM returns r 
       LEFT JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ? AND r.shop_id = ?`,
      [req.params.id, shop_id]
    );

    if (!header.length)
      return res.status(404).json({ error: "Return not found" });

    const [items] = await db.query(
      `SELECT * FROM return_items WHERE return_id = ? AND shop_id = ?`,
      [req.params.id, shop_id]
    );

    res.json({ return: header[0], items });
  } catch (err) {
    console.error("❌ Fetch Single Return Error:", err);
    res.status(500).json({ error: "Failed to fetch return" });
  }
});

/* ======================================
 🔁 4️⃣ DELETE RETURN (Revert Stock Per Shop)
====================================== */
router.delete("/:id", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const shop_id = req.shop_id;
    if (!shop_id)
      return res.status(400).json({ error: "Missing shop_id in request" });

    await connection.beginTransaction();

    const [items] = await connection.query(
      `SELECT medicine_id, qty, batch_no FROM return_items WHERE return_id = ? AND shop_id = ?`,
      [req.params.id, shop_id]
    );

    // 🔹 Reverse the stock
    for (const it of items) {
      await connection.query(
        `UPDATE product_master SET stock = GREATEST(stock - ?, 0) WHERE id = ? AND (shop_id = ? OR shop_id IS NULL)`,
        [it.qty, it.medicine_id, shop_id]
      );

      await connection.query(
        `UPDATE purchase_items 
         SET sold_qty = sold_qty + ? 
         WHERE medicine_id = ? AND batch_no = ? AND shop_id = ?
         LIMIT 1`,
        [it.qty, it.medicine_id, it.batch_no, shop_id]
      );
    }

    await connection.query(
      `DELETE FROM return_items WHERE return_id = ? AND shop_id = ?`,
      [req.params.id, shop_id]
    );
    await connection.query(
      `DELETE FROM returns WHERE id = ? AND shop_id = ?`,
      [req.params.id, shop_id]
    );

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Return Delete Error:", err);
    res.status(500).json({ error: "Failed to delete return" });
  } finally {
    connection.release();
  }
});

module.exports = router;
