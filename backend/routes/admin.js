const express           = require('express');
const adminController   = require('../controllers/adminController');
const authenticateAdmin = require('../middleware/adminAuth');
const { findAdminById } = require('../models/adminModel');

const router = express.Router();

// POST /api/admin/login
router.post('/api/admin/login', adminController.login);

// GET /api/admin/me — token verification used by the dashboard session guard
// Queries DB so the response always reflects the current name/email, not JWT-cached values.
router.get('/api/admin/me', authenticateAdmin, async (req, res) => {
  try {
    const admin = await findAdminById(req.admin.admin_id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
    return res.json({
      success: true,
      admin: { admin_id: admin.admin_id, full_name: admin.full_name, email: admin.email }
    });
  } catch (err) {
    console.error('GET /api/admin/me error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// GET /api/admin/profile — fetch admin name + email from DB
router.get('/api/admin/profile', authenticateAdmin, adminController.getAdminProfileHandler);

// PUT /api/admin/profile — update admin name + email
router.put('/api/admin/profile', authenticateAdmin, adminController.updateAdminProfileHandler);

// PUT /api/admin/password — change admin password (requires current password)
router.put('/api/admin/password', authenticateAdmin, adminController.changeAdminPasswordHandler);

// GET  /api/admin/barbers — list all barbers from the database
router.get('/api/admin/barbers', authenticateAdmin, adminController.listBarbers);

// POST /api/admin/barbers — create a new barber account
router.post('/api/admin/barbers', authenticateAdmin, adminController.createBarber);

// PUT  /api/admin/barbers/:id — update barber details
router.put('/api/admin/barbers/:id', authenticateAdmin, adminController.updateBarber);

// DELETE /api/admin/barbers/:id — delete barber (blocked if appointments exist)
router.delete('/api/admin/barbers/:id', authenticateAdmin, adminController.deleteBarber);

// GET /api/admin/dashboard/stats       — KPI aggregates
router.get('/api/admin/dashboard/stats',       authenticateAdmin, adminController.getDashboardStatsHandler);

// GET /api/admin/dashboard/charts      — weekly appointment counts (last 7 days)
router.get('/api/admin/dashboard/charts',      authenticateAdmin, adminController.getDashboardChartsHandler);

// GET /api/admin/dashboard/top-barbers — barbers ranked by completed appointments
router.get('/api/admin/dashboard/top-barbers', authenticateAdmin, adminController.getDashboardTopBarbersHandler);

// GET /api/admin/dashboard/activity    — recent appointments + barber joins
router.get('/api/admin/dashboard/activity',    authenticateAdmin, adminController.getDashboardActivityHandler);

// GET    /api/admin/services      — list all services
router.get('/api/admin/services',     authenticateAdmin, adminController.listServices);

// POST   /api/admin/services      — create a new service
router.post('/api/admin/services',    authenticateAdmin, adminController.createService);

// PUT    /api/admin/services/:id  — update service details
router.put('/api/admin/services/:id', authenticateAdmin, adminController.updateService);

// DELETE /api/admin/services/:id  — delete service (blocked if booking history exists)
router.delete('/api/admin/services/:id', authenticateAdmin, adminController.deleteService);

// GET /api/admin/appointments — list all appointments (search, filter, sort via query params)
router.get('/api/admin/appointments', authenticateAdmin, adminController.listAdminAppointments);

// GET /api/admin/dashboard/top-services — top 5 services by booking count
router.get('/api/admin/dashboard/top-services', authenticateAdmin, adminController.getDashboardTopServicesHandler);

// GET  /api/admin/notifications            — list notifications (newest first)
router.get('/api/admin/notifications',            authenticateAdmin, adminController.listAdminNotifications);

// GET  /api/admin/notifications/count      — unread notification count
router.get('/api/admin/notifications/count',      authenticateAdmin, adminController.getNotificationCount);

// POST /api/admin/notifications/mark-read  — mark all as read
router.post('/api/admin/notifications/mark-read', authenticateAdmin, adminController.markAllNotificationsReadHandler);

module.exports = router;
