// routes/productMaster.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");

/* ===============================
 🧩 Multer Configuration
=============================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* ===============================
 🔹 Helper: Get or Create ID (shop-wise)
=============================== */
async function getOrCreate(conn, table, name, shop_id) {
  if (!name || !name.trim()) return null;
  const [rows] = await conn.query(
    `SELECT id FROM ${table} WHERE shop_id = ? AND name = ? LIMIT 1`,
    [shop_id, name.trim()]
  );
  if (rows.length > 0) return rows[0].id;

  const [res] = await conn.query(
    `INSERT INTO ${table} (shop_id, name) VALUES (?, ?)`,
    [shop_id, name.trim()]
  );
  return res.insertId;
}

/* ===============================
 🔍 GET ALL PRODUCTS (Shared List)
=============================== */
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "", category = "", manufacturer = "" } = req.query;
    const offset = (page - 1) * limit;

    // 🔹 Product_master is common — no shop_id filter
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      where += " AND p.name LIKE ?";
      params.push(`%${search}%`);
    }
    if (category) {
      where += " AND c.name = ?";
      params.push(category);
    }
    if (manufacturer) {
      where += " AND m.name = ?";
      params.push(manufacturer);
    }

    const [rows] = await db.query(
      `
      SELECT 
        p.*, 
        c.name AS category, 
        m.name AS manufacturer, 
        u.name AS unit
      FROM product_master p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
      LEFT JOIN units u ON p.unit_id = u.id
      ${where}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total FROM product_master p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN manufacturers m ON p.manufacturer_id = m.id ${where}`,
      params
    );

    res.json({
      data: rows,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / limit),
    });
  } catch (err) {
    console.error("❌ Error fetching product_master:", err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

/* ===============================
 🔍 SEARCH (for purchase or sales)
=============================== */
router.get("/search", async (req, res) => {
  const q = req.query.q ? req.query.q.trim() : "";
  if (!q) return res.json([]);

  try {
    const [rows] = await db.query(
      `
      SELECT 
        id,
        name,
        hsn_code,
        pack_size,
        (SELECT name FROM units WHERE id = pm.unit_id LIMIT 1) AS unit,
        mrp_price,
        purchase_price,
        sale_price,
        gst_rate
      FROM product_master pm
      WHERE pm.name LIKE ?
      ORDER BY pm.name ASC
      LIMIT 50
      `,
      [`%${q}%`]
    );

    res.json(rows);
  } catch (err) {
    console.error("🔴 Product search failed:", err);
    res.status(500).json({ error: "Failed to search products" });
  }
});

/* ===============================
 🔹 GET SINGLE PRODUCT
=============================== */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM product_master WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Product not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Fetch single product error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* ===============================
 ➕ CREATE NEW PRODUCT
=============================== */
router.post("/", async (req, res) => {
  try {
    const {
      name,
      category_id,
      manufacturer_id,
      unit_id,
      pack_size,
      hsn_code,
      gst_rate,
      purchase_price,
      sale_price,
      mrp_price,
      stock,
    } = req.body;

    if (!name || !name.trim())
      return res.status(400).json({ error: "Product name required" });

    const [exist] = await db.query(
      "SELECT id FROM product_master WHERE name = ? LIMIT 1",
      [name.trim()]
    );
    if (exist.length > 0)
      return res.status(409).json({ error: "Duplicate product name" });

    const [result] = await db.query(
      `
      INSERT INTO product_master 
      (name, category_id, manufacturer_id, unit_id, pack_size, hsn_code, gst_rate, purchase_price, sale_price, mrp_price, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name.trim(),
        category_id || null,
        manufacturer_id || null,
        unit_id || null,
        pack_size || null,
        hsn_code || null,
        gst_rate || 0,
        purchase_price || 0,
        sale_price || 0,
        mrp_price || 0,
        stock || 0,
      ]
    );

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("❌ Insert product error:", err);
    res.status(500).json({ error: "Database error" });
  }
});



/* ===============================
 ✏️ UPDATE PRODUCT
=============================== */
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const upd = req.body;

    const fields = [];
    const vals = [];

    for (const key of [
      "name",
      "category_id",
      "manufacturer_id",
      "unit_id",
      "pack_size",
      "hsn_code",
      "gst_rate",
      "purchase_price",
      "sale_price",
      "mrp_price",
      "stock",
    ]) {
      if (upd[key] !== undefined) {
        fields.push(`${key} = ?`);
        vals.push(upd[key] === "" ? null : upd[key]);
      }
    }

    if (!fields.length)
      return res.status(400).json({ error: "Nothing to update" });

    vals.push(id);
    await db.query(`UPDATE product_master SET ${fields.join(", ")} WHERE id = ?`, vals);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Update product error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* ===============================
 🗑 DELETE PRODUCT
=============================== */
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM product_master WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* ===============================
 📦 BULK IMPORT (CSV)
=============================== */
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No CSV file uploaded" });

  const filepath = req.file.path;
  const rows = [];

  try {
    rows.push(
      ...(await new Promise((resolve, reject) => {
        const dataArr = [];
        fs.createReadStream(filepath)
          .pipe(csv())
          .on("data", (data) => dataArr.push(data))
          .on("end", () => resolve(dataArr))
          .on("error", reject);
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: "CSV parsing failed" });
  }

  let inserted = 0;
  const skipped = [];
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    for (const raw of rows) {
      const row = {};
      for (const key of Object.keys(raw)) {
        row[key.trim().toLowerCase()] = (raw[key] || "").trim();
      }

      const name = row["name"];
      if (!name) {
        skipped.push({ row, reason: "Missing product name" });
        continue;
      }

      const [exist] = await conn.query(
        "SELECT id FROM product_master WHERE name = ? LIMIT 1",
        [name]
      );
      if (exist.length > 0) {
        skipped.push({ row, reason: "Duplicate product" });
        continue;
      }

      await conn.query(
        `
        INSERT INTO product_master
        (name, category_id, manufacturer_id, unit_id, pack_size, hsn_code, gst_rate, purchase_price, sale_price, mrp_price, stock)
        VALUES (?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          name,
          row["pack_size"] || null,
          row["hsn_code"] || row["hsn"] || null,
          row["gst_rate"] ? Number(row["gst_rate"]) : 0,
          row["purchase_price"] ? Number(row["purchase_price"]) : 0,
          row["sale_price"] ? Number(row["sale_price"]) : 0,
          row["mrp_price"] ? Number(row["mrp_price"]) : 0,
          row["stock"] ? parseInt(row["stock"], 10) : 0,
        ]
      );

      inserted++;
    }

    await conn.commit();
    res.json({
      success: true,
      message: `✅ ${inserted} product(s) imported successfully!`,
      skippedCount: skipped.length,
      skipped,
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ Import error:", err);
    res.status(500).json({ error: "Import failed" });
  } finally {
    conn.release();
    fs.unlink(filepath, () => {});
  }
});

module.exports = router;
