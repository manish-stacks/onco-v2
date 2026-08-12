const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  queueLimit: 0,
  decimalNumbers: true,
  timezone: 'Z',
  charset: 'utf8mb4_unicode_ci',
});

pool.getConnection()
  .then((c) => { console.log('[db] MySQL pool connected'); c.release(); })
  .catch((e) => console.error('[db] MySQL connection failed:', e.message));

/**
 * Transaction wrapper — rollback automatic, connection release automatic.
 *   const id = await withTransaction(async (conn) => { ... return x; });
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* already rolled back */ }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = pool;
module.exports.withTransaction = withTransaction;
