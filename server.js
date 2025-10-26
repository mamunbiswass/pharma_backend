/**
 * 🚀 Pharmacy Management Server — FINAL STABLE BUILD (v4.1.0)
 * Compatible: Node.js v22+, Express v5+
 * Features: Multi-Shop + React Build Serve + Secure Auth + Upload + Offline Ready
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// ================================================
// 🌍 GLOBAL MIDDLEWARES
// ================================================
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Serve uploaded files
app.use("/uploads", express.static(uploadsDir));

// ================================================
// 🧭 FRONTEND BUILD SERVE (React Integration)
// ================================================
const frontendBuildPath = path.join(__dirname, "../frontend/build");
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  console.log("📦 React build found and served successfully!");
} else {
  console.warn("⚠️ React build folder not found at:", frontendBuildPath);
}

// ================================================
// 🧩 ROUTE IMPORTS
// ================================================
const loginRoute = require("./routes/login");
const determineShop = require("./middleware/shop");
const authMiddleware = require("./middleware/authMiddleware");

const productMasterRoutes = require("./routes/productMaster");
const categoriesRoute = require("./routes/categories");
const manufacturersRoute = require("./routes/manufacturers");
const unitRoutes = require("./routes/units");

const suppliersRoute = require("./routes/suppliers");
const customersRoute = require("./routes/customers");
const purchaseBillsRoute = require("./routes/purchaseBills");
const returnsRoute = require("./routes/returns");
const purchaseReturnsRoute = require("./routes/purchaseReturns");

const businessRoute = require("./routes/business");
const invoiceSettingsRoute = require("./routes/invoiceSettings");
const salesRoute = require("./routes/sales");

const stockRoute = require("./routes/stock");
const currentStockRoute = require("./routes/currentStock");
const lowStockRoutes = require("./routes/lowStock");
const dashboardRoute = require("./routes/dashboard");

// Optional route (Expiry Report)
let expiryReportRoute = null;
try {
  expiryReportRoute = require("./routes/expiryReport");
} catch (err) {
  console.warn("⚠️ Expiry report route not found — skipping.");
}

// ================================================
// 🔐 AUTHENTICATION ROUTE (Must be FIRST)
// ================================================
app.use("/api/login", loginRoute);

// ================================================
// 🏪 SHOP + AUTH MIDDLEWARE
// ================================================
app.use(determineShop);
app.use(authMiddleware);

// ================================================
// 📦 ROUTE REGISTRATION
// ================================================
app.use("/api/product_master", productMasterRoutes);
app.use("/api/categories", categoriesRoute);
app.use("/api/manufacturers", manufacturersRoute);
app.use("/api/units", unitRoutes);
app.use("/api/stock", stockRoute);
app.use("/api/current-stock", currentStockRoute);
app.use("/api/low-stock", lowStockRoutes);

if (expiryReportRoute) app.use("/api/reports/expiry", expiryReportRoute);

app.use("/api/business", businessRoute);
app.use("/api/purchase-bills", purchaseBillsRoute);
app.use("/api/returns", returnsRoute);
app.use("/api/purchase-returns", purchaseReturnsRoute);
app.use("/api/suppliers", suppliersRoute);
app.use("/api/customers", customersRoute);
app.use("/api/sales", salesRoute);
app.use("/api/invoice-settings", invoiceSettingsRoute);
app.use("/api/dashboard", dashboardRoute);

// ================================================
// 🖼 FILE UPLOAD (LOGO / IMAGES)
// ================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error("Only image files are allowed!"));
    }
    cb(null, true);
  },
});

// ✅ Upload Route
app.post("/api/upload-logo", (req, res) => {
  const uploader = upload.single("logo");
  uploader(req, res, (err) => {
    if (err) {
      console.error("❌ Upload error:", err.message);
      return res.status(400).json({ error: err.message });
    }
    if (!req.file)
      return res.status(400).json({ error: "No file uploaded!" });

    res.json({
      success: true,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
    });
  });
});

// ================================================
// ⚠️ 404 HANDLER (Fixed for Node v22+)
// ================================================
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api")) {
    console.warn("❌ API Route not found:", req.originalUrl);
    return res.status(404).json({ error: "API endpoint not found" });
  }
  next();
});

// ================================================
// ⚛️ REACT SPA FALLBACK ROUTE (Updated)
// ================================================
app.get(/.*/, (req, res) => {
  if (fs.existsSync(frontendBuildPath)) {
    res.sendFile(path.join(frontendBuildPath, "index.html"));
  } else {
    res.status(404).send("Frontend build not found!");
  }
});
// ================================================
// 🚀 START SERVER
// ================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("=====================================");
  console.log(`✅ Pharmacy Server running on port: ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}/api`);
  console.log("=====================================");
});
