const db = require('../config/db');

/** Add an email to the newsletter list. Re-subscribing an unsubscribed email re-activates it. */
async function subscribe(email, source = 'website') {
  await db.query(
    `INSERT INTO newsletter_subscribers (email, status, source) VALUES (?, 'active', ?)
     ON DUPLICATE KEY UPDATE status = 'active'`,
    [email, source]
  );
}

async function findByEmail(email) {
  const [[row]] = await db.query(`SELECT * FROM newsletter_subscribers WHERE email = ? LIMIT 1`, [email]);
  return row || null;
}

module.exports = { subscribe, findByEmail };
