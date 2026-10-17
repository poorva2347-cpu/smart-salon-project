const pool = require('../config/db');

async function createNotification(barberId, customerId, appointmentId, type, title, message) {
  try {
    await pool.execute(
      `INSERT INTO barber_notifications (barber_id, customer_id, appointment_id, type, title, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [barberId, customerId || null, appointmentId || null, type, title, message]
    );
  } catch (err) {
    console.error('barberNotifModel.createNotification error:', err.message);
  }
}

// For "Booking Updated" — deduplicate by refreshing the existing unread notification
// instead of inserting a new one every time a pending appointment is edited.
async function upsertBookingUpdated(barberId, customerId, appointmentId, message) {
  try {
    const [rows] = await pool.execute(
      `SELECT id FROM barber_notifications
       WHERE barber_id = ? AND appointment_id = ? AND type = 'updated' AND is_read = 0
       ORDER BY created_at DESC LIMIT 1`,
      [barberId, appointmentId]
    );
    if (rows.length > 0) {
      await pool.execute(
        `UPDATE barber_notifications SET message = ?, created_at = NOW() WHERE id = ?`,
        [message, rows[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO barber_notifications (barber_id, customer_id, appointment_id, type, title, message)
         VALUES (?, ?, ?, 'updated', 'Booking Updated', ?)`,
        [barberId, customerId || null, appointmentId, message]
      );
    }
  } catch (err) {
    console.error('barberNotifModel.upsertBookingUpdated error:', err.message);
  }
}

async function getBarberNotifications(barberId) {
  const [rows] = await pool.execute(
    `SELECT id, barber_id, customer_id, appointment_id, type, title, message, is_read, created_at
     FROM barber_notifications
     WHERE barber_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [barberId]
  );
  return rows;
}

async function getUnreadCount(barberId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt FROM barber_notifications WHERE barber_id = ? AND is_read = 0`,
    [barberId]
  );
  return rows[0].cnt;
}

async function markOneRead(notifId, barberId) {
  await pool.execute(
    `UPDATE barber_notifications SET is_read = 1 WHERE id = ? AND barber_id = ?`,
    [notifId, barberId]
  );
}

async function markAllRead(barberId) {
  await pool.execute(
    `UPDATE barber_notifications SET is_read = 1 WHERE barber_id = ? AND is_read = 0`,
    [barberId]
  );
}

module.exports = {
  createNotification,
  upsertBookingUpdated,
  getBarberNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead
};
