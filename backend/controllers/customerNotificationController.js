const customerNotifModel = require('../models/customerNotificationModel');

async function getNotifications(req, res) {
  if (!req.customer || !req.customer.customer_id)
    return res.status(403).json({ error: 'Customer authentication required.' });
  const customerId = req.customer.customer_id;
  try {
    const notifications = await customerNotifModel.getCustomerNotifications(customerId);
    const unread_count = await customerNotifModel.getUnreadCount(customerId);
    return res.json({ notifications, unread_count });
  } catch (err) {
    console.error('GET /api/customer/notifications error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function markOneRead(req, res) {
  if (!req.customer || !req.customer.customer_id)
    return res.status(403).json({ error: 'Customer authentication required.' });
  const customerId = req.customer.customer_id;
  const notifId = parseInt(req.params.id, 10);
  if (!Number.isInteger(notifId) || notifId < 1)
    return res.status(400).json({ error: 'Invalid notification ID.' });
  try {
    await customerNotifModel.markOneRead(notifId, customerId);
    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/customer/notifications/:id/read error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function markAllRead(req, res) {
  if (!req.customer || !req.customer.customer_id)
    return res.status(403).json({ error: 'Customer authentication required.' });
  const customerId = req.customer.customer_id;
  try {
    await customerNotifModel.markAllRead(customerId);
    return res.json({ success: true });
  } catch (err) {
    console.error('PUT /api/customer/notifications/read-all error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = { getNotifications, markOneRead, markAllRead };
