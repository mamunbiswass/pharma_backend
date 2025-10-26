const mysql = require("mysql2/promise");

// 🔹 Create pool with promise wrapper
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "pharmacy_db",
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
