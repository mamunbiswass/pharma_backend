const mysql = require("mysql2/promise");

// 🔹 Create pool with promise wrapper
const pool = mysql.createPool({
  host: "127.0.0.1:3306",
  user: "u174854131_pharmacy_db",
  password: "dka0H/A1",
  database: "u174854131_pharmacy_db",
  waitForConnections: true,
  connectionLimit: 10,   // কতগুলো একসাথে connection allow করবে
  queueLimit: 0          // unlimited queue
});

// ✅ Test connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL Database");
    connection.release();
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
})();

module.exports = pool;
