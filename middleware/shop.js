// middleware/shop.js
module.exports = (req, res, next) => {
  const shopId = req.headers["x-shop-id"];
  
  if (!shopId) {
    console.warn("❌ Missing x-shop-id header!");
    return res.status(400).json({ error: "Missing shop_id in request header" });
  }

  req.shop_id = parseInt(shopId);
  console.log("✅ Middleware attached shop_id:", req.shop_id);
  next();
};
