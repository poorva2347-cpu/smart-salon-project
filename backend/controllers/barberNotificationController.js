const barberNotifModel = require('../models/barberNotificationModel');

async function getNotifications(req, res) {
  if (!req.user || !req.user.barber_id)
    return res.status(403).json({ error: 'Barber authentication required.' });
  const barberId = req.user.barber_id;
  try {
    const notifications = await barberNotifModel.getBarberNotifications(barberId);
    const unread_count  = await barberNotifModel.getUnreadCount(barberId);
    return res.json({ notifications, unread_count });
  } catch (err) {
    console.error('GET /api/barber/notifications error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function markOneRead(req, res) {
  if (!req.user || !req.user.barber_id)
    return res.status(403).json({ error: 'Barber authentication required.' });
  const barberId = req.user.barber_id;
  const notifId  = parseInt(req.params.id, 10);
  if (!Number.isInteger(notifId) || notifId < 1)
    return res.status(400).json({ error: 'Invalid notification ID.' });
  try {
    await barberNotifModel.markOneRead(notifId, barberId);
    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/barber/notifications/:id/read error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function markAllRead(req, res) {
  if (!req.user || !req.user.barber_id)
    return res.status(403).json({ error: 'Barber authentication required.' });
  const barberId = req.user.barber_id;
  try {
    await barberNotifModel.markAllRead(barberId);
    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/barber/notifications/read-all error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getNotifications, markOneRead, markAllRead };
