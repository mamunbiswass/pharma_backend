// backend/middleware/authRetailer.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.retailer = decoded; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
