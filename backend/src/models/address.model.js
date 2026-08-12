const db = require('../config/db');
const { pickDefined } = require('../utils/helpers');

const WRITABLE = ['full_name', 'phone', 'city', 'state', 'pincode', 'house_no',
  'type', 'stree_address', 'landmark', 'is_default'];

async function listByCustomer(customerId) {
  const [rows] = await db.query(
    `SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, ad_id DESC`, [customerId]
  );
  return rows;
}

async function findById(adId, customerId) {
  const [[row]] = await db.query(
    `SELECT * FROM addresses WHERE ad_id = ? AND user_id = ?`, [adId, customerId]
  );
  return row || null;
}

async function create(customerId, data) {
  return db.withTransaction(async (conn) => {
    // pehla address automatically default ban jaata hai
    const [[{ count }]] = await conn.query(`SELECT COUNT(*) AS count FROM addresses WHERE user_id = ?`, [customerId]);
    const isDefault = data.is_default || count === 0 ? 1 : 0;

    if (isDefault) {
      await conn.query(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`, [customerId]);
    }

    const [result] = await conn.query(
      `INSERT INTO addresses SET ?`,
      [{
        user_id: customerId,
        full_name: data.full_name || null,
        phone: data.phone || null,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        house_no: data.house_no,
        type: data.type || 'Home',
        stree_address: data.stree_address,
        landmark: data.landmark || null,
        is_default: isDefault,
      }]
    );
    return result.insertId;
  });
}

async function update(adId, customerId, data) {
  return db.withTransaction(async (conn) => {
    const payload = pickDefined(data, WRITABLE);
    if (!Object.keys(payload).length) return false;

    if (payload.is_default) {
      await conn.query(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`, [customerId]);
    }
    const [result] = await conn.query(
      `UPDATE addresses SET ? WHERE ad_id = ? AND user_id = ?`, [payload, adId, customerId]
    );
    return result.affectedRows > 0;
  });
}

async function setDefault(adId, customerId) {
  return db.withTransaction(async (conn) => {
    await conn.query(`UPDATE addresses SET is_default = 0 WHERE user_id = ?`, [customerId]);
    const [result] = await conn.query(
      `UPDATE addresses SET is_default = 1 WHERE ad_id = ? AND user_id = ?`, [adId, customerId]
    );
    return result.affectedRows > 0;
  });
}

async function remove(adId, customerId) {
  const [result] = await db.query(`DELETE FROM addresses WHERE ad_id = ? AND user_id = ?`, [adId, customerId]);
  return result.affectedRows > 0;
}

async function getDefault(customerId) {
  const [[row]] = await db.query(
    `SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, ad_id DESC LIMIT 1`, [customerId]
  );
  return row || null;
}

module.exports = { listByCustomer, findById, create, update, setDefault, remove, getDefault };
