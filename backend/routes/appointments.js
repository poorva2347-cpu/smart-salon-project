const express      = require('express');
const pool         = require('../config/db');
const authenticate = require('../middleware/auth');
const barberNotifModel  = require('../models/barberNotificationModel');
const barberNotifCtrl   = require('../controllers/barberNotificationController');
const customerNotifCtrl = require('../controllers/customerNotificationController');
const { VALID_TIMES, toMysqlTime, isValidDateStr, isFutureOrToday } = require('../models/appointmentModel');

const router = express.Router();

// Aggregate flat JOIN rows into appointment objects with a services array
function aggregateRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.appointment_id)) {
      map.set(row.appointment_id, {
        appointment_id:    row.appointment_id,
        customer_id:       row.customer_id,
        barber_id:         row.barber_id,
        barber_name:       row.barber_name       || null,
        appointment_date:  row.appointment_date,
        appointment_time:  row.appointment_time,
        status:            row.status,
        total_amount:      parseFloat(row.total_amount),
        customer_notes:    row.customer_notes    || null,
        proposed_date:     row.proposed_date     || null,
        proposed_time:     row.proposed_time     || null,
        reschedule_reason: row.reschedule_reason || null,
        created_at:        row.created_at,
        updated_at:        row.updated_at,
        services:          []
      });
    }
    if (row.service_id !== null) {
      map.get(row.appointment_id).services.push({
        service_id:    row.service_id,
        service_name:  row.service_name,
        service_price: parseFloat(row.service_price)
      });
    }
  }
  return [...map.values()];
}

// Shared JOIN fragment — append WHERE clause before executing
const APPT_JOIN = `
  SELECT
    a.appointment_id, a.customer_id, a.barber_id, a.appointment_date,
    a.appointment_time, a.status, a.total_amount, a.customer_notes,
    a.proposed_date, a.proposed_time, a.reschedule_reason,
    a.created_at, a.updated_at,
    b.barber_name,
    asvc.service_id, asvc.service_price,
    s.service_name
  FROM appointments a
  LEFT JOIN barbers              b    ON a.barber_id      = b.barber_id
  LEFT JOIN appointment_services asvc ON a.appointment_id = asvc.appointment_id
  LEFT JOIN services             s    ON asvc.service_id  = s.service_id`;

// Shared input validation for POST and PUT — returns an error string or null
function validateBody(body) {
  const { services, barber_id, appointment_date, appointment_time } = body;

  if (!Array.isArray(services) || services.length === 0)
    return 'services must be a non-empty array of service IDs.';
  if (services.length > 4)
    return 'Maximum 4 services per appointment.';
  for (const id of services) {
    if (!Number.isInteger(id) || id < 1)
      return 'Each service must be a positive integer ID.';
  }

  if (barber_id != null && (!Number.isInteger(barber_id) || barber_id < 1))
    return 'barber_id must be a positive integer.';

  if (!appointment_date)
    return 'appointment_date is required.';
  if (!isValidDateStr(appointment_date))
    return 'appointment_date must be YYYY-MM-DD format.';
  if (!isFutureOrToday(appointment_date))
    return 'appointment_date cannot be in the past.';

  if (!appointment_time)
    return 'appointment_time is required.';
  if (!VALID_TIMES.has(appointment_time))
    return 'appointment_time must be a valid slot (e.g. "10:00 AM").';

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /appointments — Create a new appointment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/appointments', authenticate, async (req, res) => {
  const customerId = req.customer.customer_id;

  const validationError = validateBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { services, barber_id, appointment_date, appointment_time, customer_notes } = req.body;
  const uniqueSvcs = [...new Set(services)];
  const mysqlTime  = toMysqlTime(appointment_time);
  const notes      = customer_notes ? String(customer_notes).trim().slice(0, 500) : null;

  try {
    // Verify all services exist and are active
    const placeholders = uniqueSvcs.map(() => '?').join(',');
    const [svcRows] = await pool.execute(
      `SELECT service_id, price FROM services
       WHERE service_id IN (${placeholders}) AND status = 'active'`,
      uniqueSvcs
    );
    if (svcRows.length !== uniqueSvcs.length)
      return res.status(400).json({ error: 'One or more services not found or inactive.' });

    const priceMap = {};
    let total = 0;
    for (const r of svcRows) {
      priceMap[r.service_id] = parseFloat(r.price);
      total += parseFloat(r.price);
    }
    total = Math.round(total * 100) / 100;

    // Verify barber if provided
    let resolvedBarberId = null;
    if (barber_id) {
      const [bRows] = await pool.execute(
        `SELECT barber_id FROM barbers WHERE barber_id = ? AND status = 'active'`,
        [barber_id]
      );
      if (bRows.length === 0)
        return res.status(400).json({ error: 'Barber not found or inactive.' });
      resolvedBarberId = barber_id;
    }

    // Atomic insert: appointments + appointment_services
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [apptResult] = await conn.execute(
        `INSERT INTO appointments
           (customer_id, barber_id, appointment_date, appointment_time,
            status, total_amount, customer_notes)
         VALUES (?, ?, ?, ?, 'pending_approval', ?, ?)`,
        [customerId, resolvedBarberId, appointment_date, mysqlTime, total, notes]
      );
      const apptId = apptResult.insertId;

      for (const svcId of uniqueSvcs) {
        await conn.execute(
          `INSERT INTO appointment_services (appointment_id, service_id, service_price)
           VALUES (?, ?, ?)`,
          [apptId, svcId, priceMap[svcId]]
        );
      }

      await conn.commit();
      conn.release();

      const [rows] = await pool.execute(APPT_JOIN + ` WHERE a.appointment_id = ?`, [apptId]);
      const [appt] = aggregateRows(rows);

      if (resolvedBarberId) {
        try {
          const [custRows] = await pool.execute(
            `SELECT full_name FROM customers WHERE customer_id = ?`, [customerId]
          );
          const custName = custRows.length > 0 ? custRows[0].full_name : 'A customer';
          const svcNames = (appt.services || []).map(s => s.service_name).join(' + ') || 'services';
          await barberNotifModel.createNotification(
            resolvedBarberId, customerId, apptId,
            'new_request', 'New Appointment Request',
            custName + ' booked ' + svcNames
          );
        } catch (notifErr) {
          console.error('Notification error (POST /appointments):', notifErr.message);
        }
      }

      return res.status(201).json({ message: 'Appointment created successfully.', appointment: appt });

    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }

  } catch (err) {
    console.error('POST /appointments error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments — All appointments for the authenticated customer
// ─────────────────────────────────────────────────────────────────────────────
router.get('/appointments', authenticate, async (req, res) => {
  const customerId = req.customer.customer_id;
  try {
    const [rows] = await pool.execute(
      APPT_JOIN + ` WHERE a.customer_id = ? ORDER BY a.created_at DESC`,
      [customerId]
    );
    const appointments = aggregateRows(rows);
    return res.json({ appointments, total: appointments.length });
  } catch (err) {
    console.error('GET /appointments error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /appointments/:id — Single appointment with ownership check
// ─────────────────────────────────────────────────────────────────────────────
router.get('/appointments/:id', authenticate, async (req, res) => {
  const customerId = req.customer.customer_id;
  const apptId     = parseInt(req.params.id, 10);

  if (!Number.isInteger(apptId) || apptId < 1)
    return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const [owned] = await pool.execute(
      `SELECT customer_id FROM appointments WHERE appointment_id = ?`, [apptId]
    );
    if (owned.length === 0)          return res.status(404).json({ error: 'Appointment not found.' });
    if (owned[0].customer_id !== customerId) return res.status(403).json({ error: 'Access denied.' });

    const [rows] = await pool.execute(APPT_JOIN + ` WHERE a.appointment_id = ?`, [apptId]);
    const [appt] = aggregateRows(rows);
    return res.json({ appointment: appt });

  } catch (err) {
    console.error('GET /appointments/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /appointments/:id — Edit a pending appointment
// ─────────────────────────────────────────────────────────────────────────────
router.put('/appointments/:id', authenticate, async (req, res) => {
  const customerId = req.customer.customer_id;
  const apptId     = parseInt(req.params.id, 10);

  if (!Number.isInteger(apptId) || apptId < 1)
    return res.status(400).json({ error: 'Invalid appointment ID.' });

  const validationError = validateBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const { services, barber_id, appointment_date, appointment_time, customer_notes } = req.body;
  const uniqueSvcs = [...new Set(services)];
  const mysqlTime  = toMysqlTime(appointment_time);
  const notes      = customer_notes ? String(customer_notes).trim().slice(0, 500) : null;

  try {
    // Verify ownership and status before doing any DB writes
    const [owned] = await pool.execute(
      `SELECT customer_id, status FROM appointments WHERE appointment_id = ?`, [apptId]
    );
    if (owned.length === 0)          return res.status(404).json({ error: 'Appointment not found.' });
    if (owned[0].customer_id !== customerId) return res.status(403).json({ error: 'Access denied.' });
    if (!['pending', 'pending_approval'].includes(owned[0].status))
      return res.status(403).json({ error: 'Only pending appointments can be edited.' });

    // Verify services
    const placeholders = uniqueSvcs.map(() => '?').join(',');
    const [svcRows] = await pool.execute(
      `SELECT service_id, price FROM services
       WHERE service_id IN (${placeholders}) AND status = 'active'`,
      uniqueSvcs
    );
    if (svcRows.length !== uniqueSvcs.length)
      return res.status(400).json({ error: 'One or more services not found or inactive.' });

    const priceMap = {};
    let total = 0;
    for (const r of svcRows) {
      priceMap[r.service_id] = parseFloat(r.price);
      total += parseFloat(r.price);
    }
    total = Math.round(total * 100) / 100;

    // Verify barber
    let resolvedBarberId = null;
    if (barber_id) {
      const [bRows] = await pool.execute(
        `SELECT barber_id FROM barbers WHERE barber_id = ? AND status = 'active'`, [barber_id]
      );
      if (bRows.length === 0)
        return res.status(400).json({ error: 'Barber not found or inactive.' });
      resolvedBarberId = barber_id;
    }

    // Atomic update: appointments row + replace appointment_services
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE appointments
         SET barber_id = ?, appointment_date = ?, appointment_time = ?,
             total_amount = ?, customer_notes = ?, updated_at = NOW()
         WHERE appointment_id = ?`,
        [resolvedBarberId, appointment_date, mysqlTime, total, notes, apptId]
      );

      await conn.execute(
        `DELETE FROM appointment_services WHERE appointment_id = ?`, [apptId]
      );

      for (const svcId of uniqueSvcs) {
        await conn.execute(
          `INSERT INTO appointment_services (appointment_id, service_id, service_price)
           VALUES (?, ?, ?)`,
          [apptId, svcId, priceMap[svcId]]
        );
      }

      await conn.commit();
      conn.release();

      const [rows] = await pool.execute(APPT_JOIN + ` WHERE a.appointment_id = ?`, [apptId]);
      const [appt] = aggregateRows(rows);

      if (resolvedBarberId) {
        try {
          const [custRows] = await pool.execute(
            `SELECT full_name FROM customers WHERE customer_id = ?`, [customerId]
          );
          const custName = custRows.length > 0 ? custRows[0].full_name : 'A customer';
          await barberNotifModel.upsertBookingUpdated(
            resolvedBarberId, customerId, apptId,
            custName + ' updated appointment details'
          );
        } catch (notifErr) {
          console.error('Notification error (PUT /appointments):', notifErr.message);
        }
      }

      return res.json({ message: 'Appointment updated successfully.', appointment: appt });

    } catch (txErr) {
      await conn.rollback();
      conn.release();
      throw txErr;
    }

  } catch (err) {
    console.error('PUT /appointments/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /appointments/:id — Soft cancel (status → 'cancelled')
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/appointments/:id', authenticate, async (req, res) => {
  const customerId = req.customer.customer_id;
  const apptId     = parseInt(req.params.id, 10);

  if (!Number.isInteger(apptId) || apptId < 1)
    return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const [owned] = await pool.execute(
      `SELECT customer_id, status FROM appointments WHERE appointment_id = ?`, [apptId]
    );
    if (owned.length === 0)          return res.status(404).json({ error: 'Appointment not found.' });
    if (owned[0].customer_id !== customerId) return res.status(403).json({ error: 'Access denied.' });

    const { status } = owned[0];
    const CANCELLABLE = ['pending', 'pending_approval', 'confirmed'];
    if (status === 'cancelled')
      return res.status(409).json({ error: 'Appointment is already cancelled.' });
    if (!CANCELLABLE.includes(status))
      return res.status(409).json({ error: `Appointments with status '${status}' cannot be cancelled.` });

    await pool.execute(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE appointment_id = ?`,
      [apptId]
    );

    try {
      const [apptInfo] = await pool.execute(
        `SELECT a.barber_id, c.full_name AS customer_name
         FROM appointments a
         JOIN customers c ON a.customer_id = c.customer_id
         WHERE a.appointment_id = ?`,
        [apptId]
      );
      if (apptInfo.length > 0 && apptInfo[0].barber_id) {
        await barberNotifModel.createNotification(
          apptInfo[0].barber_id, customerId, apptId,
          'cancelled', 'Appointment Cancelled',
          apptInfo[0].customer_name + ' cancelled their appointment'
        );
      }
    } catch (notifErr) {
      console.error('Notification error (DELETE /appointments):', notifErr.message);
    }

    return res.json({
      message:        'Appointment cancelled successfully.',
      appointment_id: apptId,
      status:         'cancelled'
    });

  } catch (err) {
    console.error('DELETE /appointments/:id error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 7 — BARBER APPOINTMENT MANAGEMENT APIS
// All handlers are in controllers/appointmentController.js
// All DB queries and helpers are in models/appointmentModel.js
// ═════════════════════════════════════════════════════════════════════════════
const apptCtrl = require('../controllers/appointmentController');

// ── Barber endpoints — require barber JWT (payload.barber_id must be present) ─

// GET  /api/barber/appointments              — list all barber appointments (filter by ?status=)
// PUT  /api/barber/appointments/:id/accept   — pending_approval → confirmed
// PUT  /api/barber/appointments/:id/reject   — pending_approval → rejected
// PUT  /api/barber/appointments/:id/reschedule — confirmed → reschedule_proposed
// PUT  /api/barber/appointments/:id/complete — confirmed → completed
// PUT  /api/barber/appointments/:id/no-show  — confirmed → no_show

router.get('/api/barber/appointments',                   authenticate, apptCtrl.listBarberAppointments);
router.put('/api/barber/appointments/:id/accept',        authenticate, apptCtrl.acceptAppointment);
router.put('/api/barber/appointments/:id/reject',        authenticate, apptCtrl.rejectAppointment);
router.put('/api/barber/appointments/:id/reschedule',    authenticate, apptCtrl.proposeReschedule);
router.put('/api/barber/appointments/:id/complete',      authenticate, apptCtrl.completeAppointment);
router.put('/api/barber/appointments/:id/no-show',       authenticate, apptCtrl.markNoShow);

// ── Customer reschedule response endpoints — require customer JWT ──────────────

// PUT /api/appointments/:id/reschedule/accept — reschedule_proposed → confirmed
// PUT /api/appointments/:id/reschedule/reject — reschedule_proposed → cancelled
// PUT /api/appointments/:id/cancel            — pending_approval | confirmed → cancelled

router.put('/api/appointments/:id/reschedule/accept',    authenticate, apptCtrl.customerAcceptReschedule);
router.put('/api/appointments/:id/reschedule/reject',    authenticate, apptCtrl.customerRejectReschedule);
router.put('/api/appointments/:id/cancel',               authenticate, apptCtrl.customerCancelAppointment);

// ── Barber notification endpoints — require barber JWT ─────────────────────────

// GET  /api/barber/notifications           — fetch notifications (most recent 50)
// PUT  /api/barber/notifications/read-all  — mark all unread as read
// PUT  /api/barber/notifications/:id/read  — mark single notification as read

router.get('/api/barber/notifications',          authenticate, barberNotifCtrl.getNotifications);
router.put('/api/barber/notifications/read-all', authenticate, barberNotifCtrl.markAllRead);
router.put('/api/barber/notifications/:id/read', authenticate, barberNotifCtrl.markOneRead);

// ── Customer notification endpoints — require customer JWT ──────────────────────

// GET  /api/customer/notifications           — fetch notifications (most recent 50)
// PUT  /api/customer/notifications/read-all  — mark all unread as read
// PUT  /api/customer/notifications/:id/read  — mark single notification as read

router.get('/api/customer/notifications',          authenticate, customerNotifCtrl.getNotifications);
router.put('/api/customer/notifications/read-all', authenticate, customerNotifCtrl.markAllRead);
router.put('/api/customer/notifications/:id/read', authenticate, customerNotifCtrl.markOneRead);

module.exports = router;
