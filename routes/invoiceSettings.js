const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ===== Multer Storage =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/logo";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ===== UPI Validation =====
function isValidUPI(upi) {
  if (!upi) return true; // blank allowed
  const regex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return regex.test(upi);
}

// =============================================================
// ✅ GET Settings (Shop-wise)
// =============================================================
router.get("/", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;

    const [rows] = await db.query(
      "SELECT * FROM invoice_settings WHERE shop_id = ? LIMIT 1",
      [shop_id]
    );

    res.json(rows[0] || {});
  } catch (err) {
    console.error("❌ Fetch settings error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// =============================================================
// ✅ Upload Logo (Shop-wise)
// =============================================================
router.post("/upload-logo", upload.single("logo"), async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filename = req.file.filename;

    const [rows] = await db.query(
      "SELECT * FROM invoice_settings WHERE shop_id = ? LIMIT 1",
      [shop_id]
    );

    // 🔹 Delete old logo if exists
    if (rows.length > 0) {
      const oldLogo = rows[0].logo;
      if (oldLogo && fs.existsSync(`uploads/logo/${oldLogo}`)) {
        fs.unlinkSync(`uploads/logo/${oldLogo}`);
      }

      await db.query("UPDATE invoice_settings SET logo=? WHERE shop_id=?", [
        filename,
        shop_id,
      ]);
    } else {
      await db.query("INSERT INTO invoice_settings (shop_id, logo) VALUES (?, ?)", [
        shop_id,
        filename,
      ]);
    }

    res.json({
      success: true,
      message: "✅ Logo uploaded successfully",
      filename,
      url: `/uploads/logo/${filename}`,
    });
  } catch (err) {
    console.error("❌ Upload logo error:", err);
    res.status(500).json({ error: "Failed to upload logo" });
  }
});

// =============================================================
// ✅ Save Settings (Shop-wise)
// =============================================================
router.put("/", async (req, res) => {
  const shop_id = req.shop_id || 1;
  const { show_logo, show_qr, upi, footer_note, signature_text } = req.body;

  try {
    if (upi && !isValidUPI(upi)) {
      return res.status(400).json({
        error: "❌ Invalid UPI ID format! Example: mamun@ybl",
      });
    }

    const [rows] = await db.query(
      "SELECT * FROM invoice_settings WHERE shop_id = ? LIMIT 1",
      [shop_id]
    );

    if (rows.length > 0) {
      await db.query(
        `
        UPDATE invoice_settings 
        SET show_logo=?, show_qr=?, upi=?, footer_note=?, signature_text=? 
        WHERE shop_id=?
        `,
        [
          show_logo ? 1 : 0,
          show_qr ? 1 : 0,
          upi,
          footer_note,
          signature_text,
          shop_id,
        ]
      );
    } else {
      await db.query(
        `
        INSERT INTO invoice_settings 
        (shop_id, show_logo, show_qr, upi, footer_note, signature_text)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          shop_id,
          show_logo ? 1 : 0,
          show_qr ? 1 : 0,
          upi,
          footer_note,
          signature_text,
        ]
      );
    }

    res.json({ success: true, message: "✅ Settings saved successfully" });
  } catch (err) {
    console.error("❌ Save settings error:", err);
    res.status(500).json({ error: err.message || "Failed to save settings" });
  }
});

// =============================================================
// ✅ Delete Logo (Shop-wise)
// =============================================================
router.delete("/logo/:filename", async (req, res) => {
  try {
    const shop_id = req.shop_id || 1;
    const filename = req.params.filename;
    const filepath = `uploads/logo/${filename}`;

    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    await db.query(
      "UPDATE invoice_settings SET logo=NULL WHERE shop_id=?",
      [shop_id]
    );

    res.json({ success: true, message: "🗑 Logo deleted successfully" });
  } catch (err) {
    console.error("❌ Logo delete error:", err);
    res.status(500).json({ error: "Failed to delete logo" });
  }
});

module.exports = router;
