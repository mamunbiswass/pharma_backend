// backend/routes/adminRetailers.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// get all pending retailers
router.get('/pending', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, name, email, phone, status, created_at FROM retailers WHERE status = 'pending'");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// approve retailer
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE retailers SET status = 'approved' WHERE id = ?", [id]);
    res.json({ message: "Retailer approved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// reject retailer
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE retailers SET status = 'rejected' WHERE id = ?", [id]);
    res.json({ message: "Retailer rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
