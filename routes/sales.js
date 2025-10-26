const express = require("express");
const router = express.Router();
const db = require("../db");

// ===============================
// 🧾 1️⃣ SAVE NEW SALE (same as before)
// ===============================
router.post("/", async (req, res) => {
  const conn = await db.getConnection();
  try {
    const shop_id = req.shop_id || 1;
    const {
      customer_id,
      date,
      bill_type,
      payment_status,
      payment_mode,
      paid_amount,
      due_amount,
      total_amount,
      items,
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }

    // ✅ STEP 1: Validate stock
    for (const it of items) {
      const [stockRow] = await db.query(
        `SELECT stock FROM shop_products WHERE shop_id = ? AND product_id = ? LIMIT 1`,
        [shop_id, it.medicine_id]
      );

      const available = Number(stockRow[0]?.stock || 0);
      if (available < it.quantity) {
        return res.status(400).json({
          error: `❌ Not enough stock for "${it.product_name}". Available: ${available}, Requested: ${it.quantity}`,
        });
      }
    }

    await conn.beginTransaction();

    // 🔹 Generate unique invoice number
    const [last] = await conn.query(
      `SELECT id FROM sales WHERE shop_id = ? ORDER BY id DESC LIMIT 1`,
      [shop_id]
    );
    const nextNo = (last[0]?.id || 0) + 1;
    const invoiceNumber = `INV-${shop_id}-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${String(nextNo).padStart(4, "0")}`;

    // 🔹 Insert sale master
    const [saleRes] = await conn.query(
      `
      INSERT INTO sales 
      (shop_id, invoice_number, customer_id, date, bill_type, payment_status, payment_mode, paid_amount, due_amount, total, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        shop_id,
        invoiceNumber,
        customer_id,
        date,
        bill_type,
        payment_status,
        payment_mode,
        paid_amount,
        due_amount,
        total_amount,
      ]
    );

    const saleId = saleRes.insertId;

    // 🔹 Insert sale items + update stock
    for (const it of items) {
      await conn.query(
        `
        INSERT INTO sales_items 
        (shop_id, sale_id, medicine_id, product_name, hsn, batch, expiry_date, unit, qty, rate, mrp, gst, disc, amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          shop_id,
          saleId,
          it.medicine_id,
          it.product_name,
          it.hsn || "",
          it.batch_no || "",
          it.expiry_date || null,
          it.unit || "-",
          it.quantity,
          it.price,
          it.mrp_price,
          it.gst_rate,
          it.disc || 0,
          it.quantity * it.price,
        ]
      );

      // 🔹 Decrease stock
      await conn.query(
        `
        UPDATE shop_products 
        SET stock = GREATEST(stock - ?, 0)
        WHERE shop_id = ? AND product_id = ?
        `,
        [it.quantity, shop_id, it.medicine_id]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      sale_id: saleId,
      invoice_number: invoiceNumber,
      message: "✅ Sale saved successfully",
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Sale Save Error:", err);
    res.status(500).json({ error: "Failed to save sale", details: err.message });
  } finally {
    conn.release();
  }
});

// ===============================
// 🧾 2️⃣ FETCH ALL SALES (Shop-wise + Date Shortcuts)
// ===============================
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const { q, status, from, to, date_filter } = req.query;

    let query = `
      SELECT 
        s.id, 
        s.invoice_number, 
        s.date,
        s.created_at,
        s.bill_type,
        s.payment_mode,
        c.name AS customer_name,
        s.total, 
        s.paid_amount, 
        s.due_amount, 
        s.payment_status
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.shop_id = ?
    `;
    const params = [shop_id];

    // 🔹 Text search
    if (q) {
      query += ` AND (s.invoice_number LIKE ? OR c.name LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    // 🔹 Payment status
    if (status) {
      query += ` AND s.payment_status = ?`;
      params.push(status);
    }

    // 🔹 Date filter (Custom or Shortcuts)
    let dateCondition = "";

    if (date_filter === "yesterday") {
      dateCondition = "DATE(s.date) = CURDATE() - INTERVAL 1 DAY";
    } else if (date_filter === "2days") {
      dateCondition = "DATE(s.date) = CURDATE() - INTERVAL 2 DAY";
    } else if (date_filter === "3days") {
      dateCondition = "DATE(s.date) = CURDATE() - INTERVAL 3 DAY";
    } else if (from && to) {
      dateCondition = "DATE(s.date) BETWEEN ? AND ?";
      params.push(from, to);
    }

    if (dateCondition) {
      query += ` AND ${dateCondition}`;
    }

    query += ` ORDER BY s.id DESC`;

    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Fetch sales error:", err);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
});

// ===============================
// 🧾 3️⃣ FETCH SINGLE SALE (Invoice + Items)
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const { id } = req.params;

    const [saleData] = await db.query(
      `
      SELECT 
        s.*, 
        c.name AS customer_name, 
        c.phone, 
        c.address
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ? AND s.shop_id = ?
      `,
      [id, shop_id]
    );

    if (!saleData.length)
      return res.status(404).json({ error: "Sale not found" });

    const [items] = await db.query(
      `
      SELECT 
        si.id AS item_id,
        si.medicine_id,
        si.product_name,
        si.batch,
        si.unit,
        DATE_FORMAT(si.expiry_date, "%Y-%m-%d") AS expiry_date,
        si.hsn,
        si.qty,
        si.rate,
        si.mrp,
        si.gst,
        si.disc,
        si.amount
      FROM sales_items si
      WHERE si.sale_id = ? AND si.shop_id = ?
      `,
      [id, shop_id]
    );

    res.json({
      sale: saleData[0],
      items,
    });
  } catch (err) {
    console.error("❌ Fetch single sale error:", err);
    res.status(500).json({ error: "Failed to fetch sale invoice" });
  }
});

// ===============================
// 🧾 4️⃣ DELETE SALE (Restore Stock)
// ===============================
router.delete("/:id", async (req, res) => {
  const shop_id = req.shop_id || 1;
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [items] = await conn.query(
      `SELECT medicine_id, qty FROM sales_items WHERE sale_id = ? AND shop_id = ?`,
      [id, shop_id]
    );

    for (const it of items) {
      await conn.query(
        `
        UPDATE shop_products 
        SET stock = stock + ?
        WHERE shop_id = ? AND product_id = ?
        `,
        [it.qty, shop_id, it.medicine_id]
      );
    }

    await conn.query(`DELETE FROM sales_items WHERE sale_id = ? AND shop_id = ?`, [id, shop_id]);
    await conn.query(`DELETE FROM sales WHERE id = ? AND shop_id = ?`, [id, shop_id]);

    await conn.commit();
    res.json({ success: true, message: "✅ Sale deleted and stock restored" });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Sale delete error:", err);
    res.status(500).json({ error: "Failed to delete sale" });
  } finally {
    conn.release();
  }
});

module.exports = router;
