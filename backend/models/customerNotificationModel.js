const pool = require('../config/db');

async function createNotification(customerId, barberId, appointmentId, type, title, message) {
  await pool.execute(
    `INSERT INTO customer_notifications
       (customer_id, barber_id, appointment_id, type, title, message)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [customerId, barberId, appointmentId, type, title, message]
  );
}

async function getCustomerNotifications(customerId) {
  const [rows] = await pool.execute(
    `SELECT * FROM customer_notifications
     WHERE customer_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [customerId]
  );
  return rows;
}

async function getUnreadCount(customerId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM customer_notifications
     WHERE customer_id = ? AND is_read = 0`,
    [customerId]
  );
  return rows[0].cnt;
}

async function markOneRead(notifId, customerId) {
  await pool.execute(
    `UPDATE customer_notifications
     SET is_read = 1
     WHERE id = ? AND customer_id = ?`,
    [notifId, customerId]
  );
}

async function markAllRead(customerId) {
  await pool.execute(
    `UPDATE customer_notifications
     SET is_read = 1
     WHERE customer_id = ? AND is_read = 0`,
    [customerId]
  );
}

module.exports = { createNotification, getCustomerNotifications, getUnreadCount, markOneRead, markAllRead };
