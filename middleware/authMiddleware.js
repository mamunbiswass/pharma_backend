module.exports = (req, res, next) => {
  // NOTE: You can replace this with actual JWT check
  const token = req.headers.authorization;

  // For now, just simulate authentication
  if (!token) {
    // You can disable this line during dev
    // return res.status(401).json({ error: "Unauthorized access!" });
  }

  // If you want to attach user data from token:
  // req.user = decodeJWT(token);

  next();
};
