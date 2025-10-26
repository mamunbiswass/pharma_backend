const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/summary", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1; // 🏪 Shop ID from middleware

    // ---- Today's Sale (Shop-wise) ----
    const [todayRows] = await db.query(
      `
      SELECT IFNULL(SUM(total), 0) AS todaySale, COUNT(*) AS todayBills
      FROM sales 
      WHERE shop_id = ? AND DATE(created_at) = CURDATE()
      `,
      [shop_id]
    );

    // ---- Total Customers (Shop-wise) ----
    const [custRows] = await db.query(
      `SELECT COUNT(*) AS totalCustomers FROM customers WHERE shop_id = ?`,
      [shop_id]
    );

    // ---- Low Stock Medicines (exclude expired, shop-wise) ----
    const [lowStockRows] = await db.query(
      `
      SELECT 
        pm.id AS product_id,
        pm.name AS product_name,
        pi.batch_no,
        IFNULL(SUM(pi.quantity - pi.sold_qty), 0) AS available_qty,
        pi.expiry_date
      FROM purchase_items pi
      INNER JOIN product_master pm ON pm.id = pi.medicine_id
      WHERE pi.shop_id = ? 
      AND pm.shop_id = ?
      AND (pi.quantity - pi.sold_qty) > 0
      AND (pi.expiry_date IS NULL OR pi.expiry_date >= CURDATE())
      GROUP BY pm.id, pm.name, pi.batch_no, pi.expiry_date
      HAVING available_qty <= 10
      ORDER BY available_qty ASC, pi.expiry_date ASC
      LIMIT 10
      `,
      [shop_id, shop_id]
    );

    // ---- Expiring Soon (within 30 days, shop-wise) ----
    const [expRows] = await db.query(
      `
      SELECT 
        pm.name AS product_name,
        DATE_FORMAT(pi.expiry_date, '%m/%y') AS formatted_expiry
      FROM purchase_items pi
      JOIN product_master pm ON pm.id = pi.medicine_id
      WHERE pi.shop_id = ?
      AND pm.shop_id = ?
      AND pi.expiry_date IS NOT NULL
      AND pi.expiry_date >= CURDATE()
      AND pi.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY pi.expiry_date ASC
      LIMIT 10
      `,
      [shop_id, shop_id]
    );

    // ---- Weekly Sales (last 7 days, shop-wise) ----
    const [weeklyRows] = await db.query(
      `
      SELECT 
        DATE(created_at) AS date,
        IFNULL(SUM(total), 0) AS total
      FROM sales
      WHERE shop_id = ?
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
      `,
      [shop_id]
    );

    // ---- Format Weekly Data ----
    const weeklySales = weeklyRows.map((r) => ({
      day: new Date(r.date).toLocaleDateString("en-US", { weekday: "short" }),
      total: Number(r.total || 0),
    }));

    // ✅ Final Response
    res.json({
      todaySale: Number(todayRows[0]?.todaySale || 0),
      todayBills: Number(todayRows[0]?.todayBills || 0),
      totalCustomers: Number(custRows[0]?.totalCustomers || 0),
      lowStock: lowStockRows.length,
      expiringSoon: expRows.length,

      lowStockList: lowStockRows.map((r) => ({
        name: r.product_name,
        batch: r.batch_no || "-",
        available_qty: Number(r.available_qty || 0),
        expiry_date:
          r.expiry_date && r.expiry_date !== "0000-00-00"
            ? (() => {
                const d = new Date(r.expiry_date);
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const year = String(d.getFullYear()).slice(-2);
                return `${month}/${year}`; // ✅ MM/YY format
              })()
            : "—",
      })),

      expiringList: expRows.map((r) => ({
        name: r.product_name,
        expiry_date: r.formatted_expiry || "—",
      })),

      weeklySales,
    });
  } catch (err) {
    console.error("❌ Dashboard summary error:", err);
    res.status(500).json({ error: "Failed to load dashboard summary" });
  }
});

module.exports = router;
