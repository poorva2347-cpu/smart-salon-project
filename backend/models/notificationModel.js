const pool = require('../config/db');

async function getAdminNotifications({ limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  const [rows] = await pool.query(
    `SELECT id, type, sub_type, title, message, is_read, ref_id, created_at FROM admin_notifications ORDER BY created_at DESC LIMIT ${safeLimit}`
  );
  return rows;
}

async function getUnreadCount() {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM admin_notifications WHERE is_read = 0'
  );
  return Number(rows[0].cnt);
}

async function markAllNotificationsRead() {
  await pool.execute('UPDATE admin_notifications SET is_read = 1 WHERE is_read = 0');
}

async function insertAdminNotification({ type, sub_type = null, title, message, ref_id = null }) {
  const [result] = await pool.execute(
    'INSERT INTO admin_notifications (type, sub_type, title, message, ref_id) VALUES (?, ?, ?, ?, ?)',
    [type, sub_type, title, message, ref_id]
  );
  return result.insertId;
}

module.exports = {
  getAdminNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  insertAdminNotification
};
