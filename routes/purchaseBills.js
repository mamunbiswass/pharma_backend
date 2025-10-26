const express = require("express");
const router = express.Router();
const db = require("../db");

// ===== Utility Functions =====
const round2 = (n) => Number((Number(n) || 0).toFixed(2));
const num = (v, def = 0) =>
  isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : def;
const today = () => new Date().toISOString().slice(0, 10);

/* ===================================================
 ✅ Create New Purchase Bill (Multi-Shop Supported)
=================================================== */
router.post("/", async (req, res) => {
  const conn = await db.getConnection();
  try {
    const shop_id = req.shop_id || 1; // 🏪 Current shop ID
    const {
      supplier_id,
      invoice_no,
      invoice_date,
      bill_type = "Cash",
      payment_status = "Paid",
      payment_mode = "Cash",
      paid_amount = 0,
      items,
    } = req.body;

    if (!supplier_id || !invoice_no || !Array.isArray(items) || !items.length) {
      return res.status(400).json({
        error: "Missing required fields (supplier_id, invoice_no, items[] required)",
      });
    }

    // 🔹 Calculate Totals
    let subTotal = 0,
      totalGST = 0,
      totalDiscount = 0;

    const normalizedItems = items.map((it) => {
      const qty = num(it.quantity);
      const rate = num(it.purchase_rate);
      const gstPct = num(it.gst_rate);
      const discPct = num(it.discount);
      const base = round2(qty * rate);
      const gstAmt = round2(base * (gstPct / 100));
      const discAmt = round2(base * (discPct / 100));
      const total = round2(base + gstAmt - discAmt);

      subTotal += base;
      totalGST += gstAmt;
      totalDiscount += discAmt;

      return {
        medicine_id: it.medicine_id || null,
        product_name: it.product_name || it.name || "",
        batch_no: it.batch_no || "",
        expiry_date: it.expiry_date || null,
        quantity: qty,
        free_qty: num(it.free_qty),
        unit: it.unit || "",
        purchase_rate: rate,
        mrp: num(it.mrp),
        gst_rate: gstPct,
        discount: discPct,
        total,
        hsn_code: it.hsn_code || it.hsn || null,
      };
    });

    const grandTotal = round2(subTotal + totalGST - totalDiscount);

    // 🔹 Payment Calculation
    let paid = num(paid_amount);
    if (payment_status === "Paid") paid = grandTotal;
    else if (payment_status === "Unpaid") paid = 0;
    const due = round2(grandTotal - paid);

    await conn.beginTransaction();

    // 🔹 Insert into purchase_bills (shop-specific)
    const [result] = await conn.query(
      `
      INSERT INTO purchase_bills
      (shop_id, supplier_id, invoice_no, invoice_date, bill_type, payment_status, payment_mode,
       paid_amount, due_amount, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        shop_id,
        supplier_id,
        String(invoice_no).trim(),
        invoice_date || today(),
        bill_type,
        payment_status,
        payment_mode,
        round2(paid),
        round2(due),
        round2(grandTotal),
      ]
    );

    const billId = result.insertId;

    // 🔹 Insert purchase_items
    const itemQuery = `
      INSERT INTO purchase_items
      (shop_id, purchase_bill_id, medicine_id, product_name, batch_no, expiry_date,
       quantity, free_qty, unit, purchase_rate, mrp, gst_rate, discount, total, hsn_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const it of normalizedItems) {
      await conn.query(itemQuery, [
        shop_id,
        billId,
        it.medicine_id,
        it.product_name,
        it.batch_no,
        it.expiry_date,
        it.quantity,
        it.free_qty,
        it.unit,
        it.purchase_rate,
        it.mrp,
        it.gst_rate,
        it.discount,
        it.total,
        it.hsn_code,
      ]);

      // 🔹 Update shop-specific stock
      const [exists] = await conn.query(
        `SELECT id FROM shop_products WHERE shop_id = ? AND product_id = ? LIMIT 1`,
        [shop_id, it.medicine_id]
      );

      if (exists.length > 0) {
        // If exists → update stock
        await conn.query(
          `
          UPDATE shop_products
          SET 
            stock = IFNULL(stock, 0) + ?,
            purchase_rate = ?,
            mrp = ?
          WHERE shop_id = ? AND product_id = ?
          `,
          [it.quantity || 0, it.purchase_rate, it.mrp, shop_id, it.medicine_id]
        );
      } else {
        // If not exists → insert new row
        await conn.query(
          `
          INSERT INTO shop_products (shop_id, product_id, stock, purchase_rate, mrp)
          VALUES (?, ?, ?, ?, ?)
          `,
          [shop_id, it.medicine_id, it.quantity || 0, it.purchase_rate, it.mrp]
        );
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: "✅ Purchase bill saved successfully!",
      bill_id: billId,
      totals: {
        subTotal,
        totalGST,
        totalDiscount,
        grandTotal,
        paid,
        due,
      },
      itemsCount: normalizedItems.length,
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Purchase bill save error:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  } finally {
    conn.release();
  }
});

/* ===================================================
 ✅ Fetch All Purchase Bills (Shop-wise)
=================================================== */
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const [rows] = await db.query(
      `
      SELECT p.*, s.name AS supplier_name
      FROM purchase_bills p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.shop_id = ?
      ORDER BY p.id DESC
      `,
      [shop_id]
    );

    const normalized = rows.map((r) => ({
      ...r,
      total_amount: Number(r.total_amount ?? 0),
      paid_amount: Number(r.paid_amount ?? 0),
      due_amount: Number(r.due_amount ?? 0),
    }));

    res.json(normalized);
  } catch (err) {
    console.error("Fetch purchase bills error:", err);
    res.status(500).json({ error: "Failed to fetch purchase bills" });
  }
});

/* ===================================================
 ✅ Fetch Single Bill + Items (Shop-wise)
=================================================== */
router.get("/:id", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid bill id" });

    const [billRows] = await db.query(
      `
      SELECT p.*, s.name AS supplier_name
      FROM purchase_bills p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ? AND p.shop_id = ?
      `,
      [id, shop_id]
    );

    if (!billRows.length)
      return res.status(404).json({ error: "Bill not found" });

    const [items] = await db.query(
      `
      SELECT *
      FROM purchase_items
      WHERE purchase_bill_id = ? AND shop_id = ?
      ORDER BY id ASC
      `,
      [id, shop_id]
    );

    res.json({
      bill: {
        ...billRows[0],
        total_amount: Number(billRows[0].total_amount ?? 0),
        paid_amount: Number(billRows[0].paid_amount ?? 0),
        due_amount: Number(billRows[0].due_amount ?? 0),
      },
      items,
    });
  } catch (err) {
    console.error("Fetch single bill error:", err);
    res.status(500).json({ error: "Failed to fetch bill" });
  }
});

module.exports = router;
