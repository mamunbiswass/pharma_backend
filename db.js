const mysql = require("mysql2/promise");

// 🔹 Create MySQL connection pool
const pool = mysql.createPool({
  host: "srv1749.hstgr.io",               // ✅ Hostinger remote DB host
  user: "u174854131_pharmacy_db",          // ✅ Correct DB username (not _db)
  password: "dka0H/A1",                   // ✅ Your actual DB password
  database: "u174854131_pharmacy_db",     // ✅ Database name
  waitForConnections: true,
  connectionLimit: 10,                    // 10 connections is enough
  queueLimit: 0,
  connectTimeout: 20000,                  // 20 sec timeout for remote DB
});

// ✅ Test connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL Database successfully!");
    connection.release();
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
})();

module.exports = pool;
