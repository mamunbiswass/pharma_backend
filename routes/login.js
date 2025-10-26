const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const [rows] = await db.query(
      `
      SELECT 
        u.id, u.name, u.email, u.password, 
        s.id AS shop_id, s.shop_name, s.owner_name, s.phone AS shop_phone, s.address AS shop_address
      FROM users u
      JOIN shops s ON s.id = u.shop_id
      WHERE u.email = ?
      LIMIT 1
      `,
      [email]
    );

    if (!rows.length)
      return res.status(401).json({ error: "Invalid email or password" });

    const user = rows[0];
    if (user.password !== password)
      return res.status(401).json({ error: "Invalid email or password" });

    res.json({
      success: true,
      message: "✅ Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        shop_id: user.shop_id,
        shop_name: user.shop_name,
        owner_name: user.owner_name,
        shop_phone: user.shop_phone,
        shop_address: user.shop_address,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;
