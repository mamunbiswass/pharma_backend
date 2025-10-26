const express = require("express");
const router = express.Router();
const db = require("../db"); // mysql2/promise pool

// =======================
// 🔹 Get Business Info (Per Shop)
// =======================
router.get("/", async (req, res) => {
  console.log("🧭 Business API Hit | shop_id =", req.shop_id);
  try {
    const shopId = req.shop_id; // ✅ from middleware

    if (!shopId) {
      return res.status(400).json({ error: "Missing shop_id in request" });
    }

    const [rows] = await db.query(
      "SELECT * FROM business_info WHERE shop_id = ? LIMIT 1",
      [shopId]
    );

    res.json(rows[0] || {});
  } catch (err) {
    console.error("❌ Fetch business info error:", err);
    res.status(500).json({ error: "Failed to fetch business info" });
  }
});

// =======================
// 🔹 Save or Update Business Info (Per Shop)
// =======================
router.post("/", async (req, res) => {
  const shopId = req.shop_id; // ✅ from middleware
  const { name, address, phone, email, tax_number } = req.body;

  if (!shopId) {
    return res.status(400).json({ error: "Missing shop_id in request" });
  }

  try {
    // Check if record already exists for this shop
    const [rows] = await db.query(
      "SELECT id FROM business_info WHERE shop_id = ? LIMIT 1",
      [shopId]
    );

    if (rows.length > 0) {
      // 🔹 Update existing record for this shop
      await db.query(
        `UPDATE business_info 
         SET name=?, address=?, phone=?, email=?, tax_number=?, updated_at=NOW() 
         WHERE shop_id=?`,
        [name, address, phone, email, tax_number, shopId]
      );

      res.json({
        success: true,
        message: "✅ Business info updated successfully",
      });
    } else {
      // 🔹 Insert new record for this shop
      await db.query(
        `INSERT INTO business_info 
         (shop_id, name, address, phone, email, tax_number, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [shopId, name, address, phone, email, tax_number]
      );

      res.json({
        success: true,
        message: "✅ Business info saved successfully",
      });
    }
  } catch (err) {
    console.error("❌ Save business info error:", err);
    res.status(500).json({ error: "Failed to save business info" });
  }
});

module.exports = router;
