const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * ✅ Expiry Report (Shop-wise)
 * Show ONLY products that:
 *   - belong to current shop_id
 *   - have stock > 0 (not sold out)
 *   - and are expired or near expiry (within 30 days)
 */
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1; // 🏪 default shop if missing

    const [rows] = await db.query(
      `
      SELECT 
          p.id AS product_id,
          p.name AS product_name,
          pi.batch_no,
          pi.expiry_date,
          (pi.quantity - pi.sold_qty) AS qty,
          pi.mrp,
          pi.purchase_rate,
          p.hsn_code AS hsn,
          p.gst_rate,
          s.name AS supplier_name,
          CASE 
              WHEN pi.expiry_date < CURDATE() THEN 'expired'
              WHEN pi.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'near'
          END AS expiry_status
      FROM purchase_items pi
      LEFT JOIN product_master p ON pi.medicine_id = p.id
      LEFT JOIN purchase_bills pb ON pi.purchase_bill_id = pb.id
      LEFT JOIN suppliers s ON pb.supplier_id = s.id
      WHERE 
          pi.shop_id = ? 
          AND p.shop_id = ?
          AND pi.expiry_date IS NOT NULL 
          AND pi.expiry_date <> ''
          AND (pi.quantity - pi.sold_qty) > 0
          AND (
              pi.expiry_date < CURDATE() 
              OR pi.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          )
      ORDER BY pi.expiry_date ASC
      `,
      [shop_id, shop_id]
    );

    // Separate expired and near-expiry products
    const expired = rows.filter((r) => r.expiry_status === "expired");
    const nearExpiry = rows.filter((r) => r.expiry_status === "near");

    res.json({
      expired,
      nearExpiry,
      expiredCount: expired.length,
      nearCount: nearExpiry.length,
    });
  } catch (err) {
    console.error("❌ Expiry Report Error:", err);
    res.status(500).json({ error: "Failed to load expiry report" });
  }
});

module.exports = router;
