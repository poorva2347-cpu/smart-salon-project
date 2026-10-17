const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { findAdminByEmail, findAdminById, isEmailTakenByOther, updateAdminRow, updateAdminPassword } = require('../models/adminModel');
const { findBarberByEmail, insertBarber, getAllBarbers, findBarberById, updateBarberRow, deleteBarberRow, barberHasAppointments } = require('../models/barberModel');
const { getDashboardStats, getWeeklyChart, getTopBarbers, getRecentActivity, getTopServices } = require('../models/dashboardModel');
const { getAllServices, findServiceById, findServiceByName, insertService, updateServiceRow, deleteServiceRow, serviceHasBookings } = require('../models/serviceModel');
const { getAdminAppointments } = require('../models/appointmentModel');
const { getAdminNotifications, getUnreadCount, markAllNotificationsRead, insertAdminNotification } = require('../models/notificationModel');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const admin = await findAdminByEmail(email);

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Contact support.' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { admin_id: admin.admin_id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await pool.execute(
      'UPDATE admins SET last_login = NOW() WHERE admin_id = ?',
      [admin.admin_id]
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      admin: {
        admin_id:  admin.admin_id,
        full_name: admin.full_name,
        email:     admin.email
      }
    });

  } catch (err) {
    console.error('Admin login error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function createBarber(req, res) {
  const {
    barber_name,
    email,
    phone,
    password,
    specialization,
    experience_years,
    status
  } = req.body;

  // Required fields
  if (!barber_name || !String(barber_name).trim()) {
    return res.status(400).json({ success: false, message: 'Barber name is required.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required.' });
  }

  // Email format
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }

  // Experience years — optional but must be a non-negative integer when supplied
  let resolvedExp = null;
  if (experience_years !== undefined && experience_years !== null && experience_years !== '') {
    const exp = Number(experience_years);
    if (!Number.isInteger(exp) || exp < 0 || exp > 60) {
      return res.status(400).json({ success: false, message: 'Experience years must be a whole number between 0 and 60.' });
    }
    resolvedExp = exp;
  }

  // Status — defaults to 'active'; only 'active' or 'inactive' are valid
  const resolvedStatus = status || 'active';
  if (resolvedStatus !== 'active' && resolvedStatus !== 'inactive') {
    return res.status(400).json({ success: false, message: 'Status must be "active" or "inactive".' });
  }

  try {
    // Duplicate email check
    const existing = await findBarberByEmail(String(email).trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'A barber with this email already exists.' });
    }

    // Hash password using the same config as the rest of the project
    const password_hash = await bcrypt.hash(password, 10);

    const barberId = await insertBarber({
      barber_name:      String(barber_name).trim(),
      email:            String(email).trim(),
      phone:            String(phone).trim(),
      password_hash,
      specialization:   specialization ? String(specialization).trim() : null,
      experience_years: resolvedExp,
      status:           resolvedStatus
    });

    insertAdminNotification({
      type: 'barber', sub_type: 'added',
      title: 'Barber Added',
      message: String(barber_name).trim() + ' was added to the team.',
      ref_id: barberId
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Barber created successfully.',
      barber: {
        barber_id:        barberId,
        barber_name:      String(barber_name).trim(),
        email:            String(email).trim().toLowerCase(),
        phone:            String(phone).trim(),
        specialization:   specialization ? String(specialization).trim() : null,
        experience_years: resolvedExp,
        status:           resolvedStatus,
        is_available:     1,
        image_url:        null
      }
    });

  } catch (err) {
    console.error('Create barber error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function listBarbers(req, res) {
  try {
    const rows = await getAllBarbers();
    return res.json({ success: true, barbers: rows });
  } catch (err) {
    console.error('List barbers error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function updateBarber(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid barber ID.' });
  }

  const { barber_name, email, phone, specialization, experience_years, status } = req.body;

  if (!barber_name || !String(barber_name).trim()) {
    return res.status(400).json({ success: false, message: 'Barber name is required.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }
  if (!phone || !String(phone).trim()) {
    return res.status(400).json({ success: false, message: 'Phone number is required.' });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }

  let resolvedExp = null;
  if (experience_years !== undefined && experience_years !== null && experience_years !== '') {
    const exp = Number(experience_years);
    if (!Number.isInteger(exp) || exp < 0 || exp > 60) {
      return res.status(400).json({ success: false, message: 'Experience years must be a whole number between 0 and 60.' });
    }
    resolvedExp = exp;
  }

  const resolvedStatus = status || 'active';
  if (resolvedStatus !== 'active' && resolvedStatus !== 'inactive') {
    return res.status(400).json({ success: false, message: 'Status must be "active" or "inactive".' });
  }

  try {
    const existing = await findBarberById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Barber not found.' });
    }

    const emailOwner = await findBarberByEmail(String(email).trim());
    if (emailOwner && emailOwner.barber_id !== id) {
      return res.status(409).json({ success: false, message: 'This email is already used by another barber.' });
    }

    await updateBarberRow(id, {
      barber_name:      String(barber_name).trim(),
      email:            String(email).trim(),
      phone:            String(phone).trim(),
      specialization:   specialization ? String(specialization).trim() : null,
      experience_years: resolvedExp,
      status:           resolvedStatus
    });

    if (existing.status !== resolvedStatus) {
      insertAdminNotification({
        type: 'barber', sub_type: 'status_changed',
        title: 'Barber Status Changed',
        message: String(barber_name).trim() + '\'s status changed to ' + resolvedStatus + '.',
        ref_id: id
      }).catch(() => {});
    }

    const updated = await findBarberById(id);
    return res.json({
      success: true,
      message: 'Barber updated successfully.',
      barber:  updated
    });
  } catch (err) {
    console.error('Update barber error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function deleteBarber(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid barber ID.' });
  }

  try {
    const existing = await findBarberById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Barber not found.' });
    }

    const hasAppts = await barberHasAppointments(id);
    if (hasAppts) {
      return res.status(409).json({
        success: false,
        message: 'This barber has appointment history. Please mark them inactive instead.'
      });
    }

    await deleteBarberRow(id);

    insertAdminNotification({
      type: 'barber', sub_type: 'deleted',
      title: 'Barber Removed',
      message: existing.barber_name + ' was removed from the team.',
      ref_id: id
    }).catch(() => {});

    return res.json({ success: true, message: 'Barber deleted successfully.' });
  } catch (err) {
    console.error('Delete barber error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getDashboardStatsHandler(req, res) {
  try {
    const stats = await getDashboardStats();
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getDashboardChartsHandler(req, res) {
  try {
    const rows = await getWeeklyChart();

    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const countMap  = {};
    rows.forEach(function(row) {
      const dateStr = row.appt_date instanceof Date
        ? row.appt_date.toISOString().slice(0, 10)
        : String(row.appt_date);
      countMap[dateStr] = parseInt(row.count, 10);
    });

    const weekly = [];
    for (let i = 6; i >= 0; i--) {
      const d     = new Date();
      d.setDate(d.getDate() - i);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day   = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      weekly.push({ day: DAY_NAMES[d.getDay()], date: dateStr, count: countMap[dateStr] || 0 });
    }

    return res.json({ success: true, weekly });
  } catch (err) {
    console.error('Dashboard charts error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getDashboardTopBarbersHandler(req, res) {
  try {
    const barbers = await getTopBarbers();
    return res.json({ success: true, barbers });
  } catch (err) {
    console.error('Dashboard top-barbers error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getDashboardActivityHandler(req, res) {
  try {
    const activity = await getRecentActivity();
    return res.json({ success: true, activity });
  } catch (err) {
    console.error('Dashboard activity error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// ── Services ──────────────────────────────────────────────────

async function listServices(req, res) {
  try {
    const rows = await getAllServices();
    return res.json({ success: true, services: rows });
  } catch (err) {
    console.error('List services error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function createService(req, res) {
  const { service_name, description, price, duration_minutes, status } = req.body;

  if (!service_name || !String(service_name).trim()) {
    return res.status(400).json({ success: false, message: 'Service name is required.' });
  }

  const priceNum = Number(price);
  if (price === undefined || price === null || price === '' || isNaN(priceNum) || priceNum <= 0) {
    return res.status(400).json({ success: false, message: 'Price must be a number greater than zero.' });
  }

  const durationNum = Number(duration_minutes);
  if (!duration_minutes || isNaN(durationNum) || !Number.isInteger(durationNum) || durationNum <= 0) {
    return res.status(400).json({ success: false, message: 'Duration must be a positive whole number of minutes.' });
  }

  const resolvedStatus = status || 'active';
  if (resolvedStatus !== 'active' && resolvedStatus !== 'inactive') {
    return res.status(400).json({ success: false, message: 'Status must be "active" or "inactive".' });
  }

  try {
    const existing = await findServiceByName(String(service_name).trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'A service with this name already exists.' });
    }

    const serviceId = await insertService({
      service_name:     String(service_name).trim(),
      description:      description ? String(description).trim() : null,
      price:            priceNum,
      duration_minutes: durationNum,
      status:           resolvedStatus
    });

    insertAdminNotification({
      type: 'service', sub_type: 'added',
      title: 'Service Added',
      message: '"' + String(service_name).trim() + '" was added to the menu.',
      ref_id: serviceId
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      service: {
        service_id:       serviceId,
        service_name:     String(service_name).trim(),
        description:      description ? String(description).trim() : null,
        price:            priceNum,
        duration_minutes: durationNum,
        status:           resolvedStatus,
        booking_count:    0
      }
    });
  } catch (err) {
    console.error('Create service error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function updateService(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }

  const { service_name, description, price, duration_minutes, status } = req.body;

  if (!service_name || !String(service_name).trim()) {
    return res.status(400).json({ success: false, message: 'Service name is required.' });
  }

  const priceNum = Number(price);
  if (price === undefined || price === null || price === '' || isNaN(priceNum) || priceNum <= 0) {
    return res.status(400).json({ success: false, message: 'Price must be a number greater than zero.' });
  }

  const durationNum = Number(duration_minutes);
  if (!duration_minutes || isNaN(durationNum) || !Number.isInteger(durationNum) || durationNum <= 0) {
    return res.status(400).json({ success: false, message: 'Duration must be a positive whole number of minutes.' });
  }

  const resolvedStatus = status || 'active';
  if (resolvedStatus !== 'active' && resolvedStatus !== 'inactive') {
    return res.status(400).json({ success: false, message: 'Status must be "active" or "inactive".' });
  }

  try {
    const existing = await findServiceById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const nameOwner = await findServiceByName(String(service_name).trim(), id);
    if (nameOwner) {
      return res.status(409).json({ success: false, message: 'A service with this name already exists.' });
    }

    await updateServiceRow(id, {
      service_name:     String(service_name).trim(),
      description:      description ? String(description).trim() : null,
      price:            priceNum,
      duration_minutes: durationNum,
      status:           resolvedStatus
    });

    insertAdminNotification({
      type: 'service', sub_type: 'updated',
      title: 'Service Updated',
      message: '"' + String(service_name).trim() + '" service was updated.',
      ref_id: id
    }).catch(() => {});

    return res.json({
      success: true,
      message: 'Service updated successfully.',
      service: {
        service_id:       id,
        service_name:     String(service_name).trim(),
        description:      description ? String(description).trim() : null,
        price:            priceNum,
        duration_minutes: durationNum,
        status:           resolvedStatus
      }
    });
  } catch (err) {
    console.error('Update service error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function deleteService(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }

  try {
    const existing = await findServiceById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const hasBookings = await serviceHasBookings(id);
    if (hasBookings) {
      return res.status(409).json({
        success: false,
        message: 'This service has booking history. Please mark it inactive instead.'
      });
    }

    insertAdminNotification({
      type: 'service', sub_type: 'deleted',
      title: 'Service Deleted',
      message: '"' + existing.service_name + '" service was deleted.',
      ref_id: id
    }).catch(() => {});

    await deleteServiceRow(id);
    return res.json({ success: true, message: 'Service deleted successfully.' });
  } catch (err) {
    console.error('Delete service error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// ── Dashboard: Top Services ───────────────────────────────────

async function getDashboardTopServicesHandler(req, res) {
  try {
    const services = await getTopServices();
    return res.json({ success: true, services });
  } catch (err) {
    console.error('Dashboard top-services error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// ── Appointments ──────────────────────────────────────────────

async function listAdminAppointments(req, res) {
  try {
    const { status, search, sort } = req.query;
    const rows = await getAdminAppointments({
      status: status  ? String(status).trim()  : null,
      search: search  ? String(search).trim()  : null,
      sort:   sort    ? String(sort).trim()    : 'newest'
    });
    return res.json({ success: true, appointments: rows });
  } catch (err) {
    console.error('Admin list appointments error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// ── Notifications ─────────────────────────────────────────────

async function listAdminNotifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const notifications = await getAdminNotifications({ limit });
    return res.json({ success: true, notifications });
  } catch (err) {
    console.error('List notifications error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function getNotificationCount(req, res) {
  try {
    const count = await getUnreadCount();
    return res.json({ success: true, count });
  } catch (err) {
    console.error('Notification count error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function markAllNotificationsReadHandler(req, res) {
  try {
    await markAllNotificationsRead();
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// ── Admin Profile ─────────────────────────────────────────────

async function getAdminProfileHandler(req, res) {
  try {
    const admin = await findAdminById(req.admin.admin_id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });
    return res.json({
      success: true,
      admin: { admin_id: admin.admin_id, full_name: admin.full_name, email: admin.email }
    });
  } catch (err) {
    console.error('Get admin profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

async function updateAdminProfileHandler(req, res) {
  const { full_name, email } = req.body;

  if (!full_name || !String(full_name).trim()) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }

  try {
    const taken = await isEmailTakenByOther(String(email).trim(), req.admin.admin_id);
    if (taken) {
      return res.status(409).json({ success: false, message: 'This email is already in use.' });
    }
    await updateAdminRow(req.admin.admin_id, {
      full_name: String(full_name).trim(),
      email:     String(email).trim()
    });
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      admin: { admin_id: req.admin.admin_id, full_name: String(full_name).trim(), email: String(email).trim() }
    });
  } catch (err) {
    console.error('Update admin profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

async function changeAdminPasswordHandler(req, res) {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
  }
  if (!PW_RE.test(new_password)) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    });
  }

  try {
    const admin = await findAdminById(req.admin.admin_id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found.' });

    const match = await bcrypt.compare(current_password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await updateAdminPassword(req.admin.admin_id, newHash);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change admin password error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = {
  login,
  createBarber,
  listBarbers,
  updateBarber,
  deleteBarber,
  getDashboardStatsHandler,
  getDashboardChartsHandler,
  getDashboardTopBarbersHandler,
  getDashboardActivityHandler,
  getDashboardTopServicesHandler,
  listServices,
  createService,
  updateService,
  deleteService,
  listAdminAppointments,
  listAdminNotifications,
  getNotificationCount,
  markAllNotificationsReadHandler,
  getAdminProfileHandler,
  updateAdminProfileHandler,
  changeAdminPasswordHandler
};
