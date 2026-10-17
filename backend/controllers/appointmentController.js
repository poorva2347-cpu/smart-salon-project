const { pool, toMysqlTime, isValidDateStr, isFutureOrToday, VALID_TIMES,
        getAppointmentById, getBarberAppointments } = require('../models/appointmentModel');
const barberNotifModel   = require('../models/barberNotificationModel');
const customerNotifModel = require('../models/customerNotificationModel');

// ─── Allowed status values (final state machine) ──────────────────────────────
const VALID_STATUSES = new Set([
  'pending', 'pending_approval', 'confirmed', 'reschedule_proposed',
  'completed', 'no_show', 'cancelled', 'rejected'
]);

// NOTE — Status compatibility shim:
// The existing POST /appointments customer route inserts with status = 'pending'.
// Until that route is updated to use 'pending_approval', barber accept and reject
// actions treat both values as equivalent. See schema recommendations in the
// Phase 7 implementation report.
const PENDING_STATUSES = new Set(['pending_approval', 'pending']);

// ─── Parse and validate appointment ID from route params ──────────────────────
function parseApptId(params) {
  const id = parseInt(params.id, 10);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

// ─── Guard: request must carry a barber JWT (payload contains barber_id) ──────
function requireBarber(req, res) {
  if (!req.user || !req.user.barber_id) {
    res.status(403).json({ error: 'Barber authentication required.' });
    return false;
  }
  return true;
}

// ─── Guard: request must carry a customer JWT (payload contains customer_id) ───
function requireCustomer(req, res) {
  if (!req.customer || !req.customer.customer_id) {
    res.status(403).json({ error: 'Customer authentication required.' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/barber/appointments
//
// Returns all appointments assigned to the authenticated barber.
// Optional query param: ?status=<status>
// Supports tab groupings: pending_approval | confirmed | reschedule_proposed |
//                         completed | no_show | cancelled | rejected
// ─────────────────────────────────────────────────────────────────────────────
async function listBarberAppointments(req, res) {
  if (!requireBarber(req, res)) return;

  const barberId     = req.user.barber_id;
  const statusFilter = req.query.status || null;

  if (statusFilter && !VALID_STATUSES.has(statusFilter)) {
    return res.status(400).json({
      error: `Invalid status filter. Allowed values: ${[...VALID_STATUSES].join(', ')}.`
    });
  }

  try {
    const appointments = await getBarberAppointments(barberId, statusFilter);
    return res.json({
      appointments,
      total:  appointments.length,
      filter: statusFilter || 'all'
    });
  } catch (err) {
    console.error('GET /api/barber/appointments error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/barber/appointments/:id/accept
//
// Transition: pending_approval → confirmed
// The barber confirms the customer's booking request.
// ─────────────────────────────────────────────────────────────────────────────
async function acceptAppointment(req, res) {
  if (!requireBarber(req, res)) return;

  const barberId = req.user.barber_id;
  const apptId   = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.barber_id !== barberId)
      return res.status(403).json({ error: 'You are not authorized to manage this appointment.' });

    if (!PENDING_STATUSES.has(appt.status))
      return res.status(409).json({
        error: `Cannot accept an appointment with status '${appt.status}'. Only 'pending_approval' appointments can be accepted.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status = 'confirmed', updated_at = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.customer_id) {
      try {
        await customerNotifModel.createNotification(
          appt.customer_id, barberId, apptId,
          'confirmed', 'Appointment Confirmed',
          'Your appointment has been confirmed by your barber.'
        );
      } catch (notifErr) {
        console.error('Notification error (acceptAppointment):', notifErr.message);
      }
    }

    const updated = await getAppointmentById(apptId);
    return res.json({
      message:     'Appointment confirmed successfully.',
      appointment: updated
    });

  } catch (err) {
    console.error('PUT /api/barber/appointments/:id/accept error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/barber/appointments/:id/reject
//
// Transition: pending_approval → rejected
// Body (optional): { "reason": "..." }
// ─────────────────────────────────────────────────────────────────────────────
async function rejectAppointment(req, res) {
  if (!requireBarber(req, res)) return;

  const barberId = req.user.barber_id;
  const apptId   = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  const reason = req.body && req.body.reason
    ? String(req.body.reason).trim().slice(0, 500)
    : null;

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.barber_id !== barberId)
      return res.status(403).json({ error: 'You are not authorized to manage this appointment.' });

    if (!PENDING_STATUSES.has(appt.status))
      return res.status(409).json({
        error: `Cannot reject an appointment with status '${appt.status}'. Only 'pending_approval' appointments can be rejected.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status = 'rejected', updated_at = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.customer_id) {
      try {
        await customerNotifModel.createNotification(
          appt.customer_id, barberId, apptId,
          'rejected', 'Appointment Rejected',
          'Your appointment request was not accepted.'
        );
      } catch (notifErr) {
        console.error('Notification error (rejectAppointment):', notifErr.message);
      }
    }

    return res.json({
      message:        'Appointment rejected.',
      appointment_id: apptId,
      status:         'rejected',
      reason:         reason || null
    });

  } catch (err) {
    console.error('PUT /api/barber/appointments/:id/reject error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/barber/appointments/:id/reschedule
//
// Transition: confirmed → reschedule_proposed
// Writes proposed_date, proposed_time, reschedule_reason to the row.
// Customer must respond via /api/appointments/:id/reschedule/accept|reject.
//
// Body: {
//   "proposed_date": "YYYY-MM-DD",
//   "proposed_time": "H:MM AM/PM",
//   "reason":        "optional explanation"
// }
// ─────────────────────────────────────────────────────────────────────────────
async function proposeReschedule(req, res) {
  if (!requireBarber(req, res)) return;

  const barberId = req.user.barber_id;
  const apptId   = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  const { proposed_date, proposed_time, reason } = req.body || {};

  if (!proposed_date)
    return res.status(400).json({ error: 'proposed_date is required.' });
  if (!isValidDateStr(proposed_date))
    return res.status(400).json({ error: 'proposed_date must be YYYY-MM-DD format.' });
  if (!isFutureOrToday(proposed_date))
    return res.status(400).json({ error: 'proposed_date cannot be in the past.' });
  if (!proposed_time)
    return res.status(400).json({ error: 'proposed_time is required.' });
  if (!VALID_TIMES.has(proposed_time))
    return res.status(400).json({
      error: `proposed_time must be a valid slot (e.g. "10:00 AM"). Valid values: ${[...VALID_TIMES].join(', ')}.`
    });

  const mysqlProposedTime = toMysqlTime(proposed_time);
  const cleanReason       = reason ? String(reason).trim().slice(0, 500) : null;

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.barber_id !== barberId)
      return res.status(403).json({ error: 'You are not authorized to manage this appointment.' });

    if (appt.status !== 'confirmed')
      return res.status(409).json({
        error: `Cannot propose a reschedule for appointment with status '${appt.status}'. Only 'confirmed' appointments can be rescheduled.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status            = 'reschedule_proposed',
           proposed_date     = ?,
           proposed_time     = ?,
           reschedule_reason = ?,
           updated_at        = NOW()
       WHERE appointment_id = ?`,
      [proposed_date, mysqlProposedTime, cleanReason, apptId]
    );

    if (appt.customer_id) {
      try {
        const barberName = appt.barber_name || 'Your barber';
        const dateObj    = new Date(proposed_date + 'T00:00:00');
        const dateStr    = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        await customerNotifModel.createNotification(
          appt.customer_id, appt.barber_id, apptId,
          'reschedule_proposed', 'Reschedule Request',
          barberName + ' proposed ' + dateStr + ' at ' + proposed_time
        );
      } catch (notifErr) {
        console.error('Notification error (proposeReschedule):', notifErr.message);
      }
    }

    const updated = await getAppointmentById(apptId);
    return res.json({
      message:     'Reschedule proposal sent. Awaiting customer response.',
      appointment: updated
    });

  } catch (err) {
    console.error('PUT /api/barber/appointments/:id/reschedule error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/barber/appointments/:id/complete
//
// Transition: confirmed → completed
// Marks the service as delivered. Terminal state.
// ─────────────────────────────────────────────────────────────────────────────
async function completeAppointment(req, res) {
  if (!requireBarber(req, res)) return;

  const barberId = req.user.barber_id;
  const apptId   = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.barber_id !== barberId)
      return res.status(403).json({ error: 'You are not authorized to manage this appointment.' });

    if (appt.status !== 'confirmed')
      return res.status(409).json({
        error: `Cannot complete an appointment with status '${appt.status}'. Only 'confirmed' appointments can be marked complete.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status = 'completed', updated_at = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.customer_id) {
      try {
        await customerNotifModel.createNotification(
          appt.customer_id, appt.barber_id, apptId,
          'completed', 'Appointment Completed',
          'Your appointment has been marked as completed. Thank you!'
        );
      } catch (notifErr) {
        console.error('Notification error (completeAppointment):', notifErr.message);
      }
    }

    const updated = await getAppointmentById(apptId);
    return res.json({
      message:     'Appointment marked as completed.',
      appointment: updated
    });

  } catch (err) {
    console.error('PUT /api/barber/appointments/:id/complete error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/barber/appointments/:id/no-show
//
// Transition: confirmed → no_show
// Customer did not arrive. Terminal state.
// ─────────────────────────────────────────────────────────────────────────────
async function markNoShow(req, res) {
  if (!requireBarber(req, res)) return;

  const barberId = req.user.barber_id;
  const apptId   = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.barber_id !== barberId)
      return res.status(403).json({ error: 'You are not authorized to manage this appointment.' });

    if (appt.status !== 'confirmed')
      return res.status(409).json({
        error: `Cannot mark no-show for appointment with status '${appt.status}'. Only 'confirmed' appointments can be marked as no-show.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status = 'no_show', updated_at = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.customer_id) {
      try {
        await customerNotifModel.createNotification(
          appt.customer_id, appt.barber_id, apptId,
          'no_show', 'Appointment No Show',
          'Your appointment was marked as no-show. Please rebook if needed.'
        );
      } catch (notifErr) {
        console.error('Notification error (markNoShow):', notifErr.message);
      }
    }

    const updated = await getAppointmentById(apptId);
    return res.json({
      message:     'Appointment marked as no-show.',
      appointment: updated
    });

  } catch (err) {
    console.error('PUT /api/barber/appointments/:id/no-show error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/appointments/:id/reschedule/accept
//
// Transition: reschedule_proposed → confirmed (using proposed_date / proposed_time)
// The confirmed appointment moves to the new barber-proposed date and time.
// proposed_date, proposed_time, reschedule_reason are cleared after application.
// ─────────────────────────────────────────────────────────────────────────────
async function customerAcceptReschedule(req, res) {
  if (!requireCustomer(req, res)) return;

  const customerId = req.customer.customer_id;
  const apptId     = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.customer_id !== customerId)
      return res.status(403).json({ error: 'Access denied.' });

    if (appt.status !== 'reschedule_proposed')
      return res.status(409).json({
        error: `Cannot accept reschedule for appointment with status '${appt.status}'.`
      });

    if (!appt.proposed_date || !appt.proposed_time)
      return res.status(409).json({
        error: 'No reschedule proposal found for this appointment.'
      });

    // Apply proposed slot as the new confirmed date/time; clear proposal fields
    await pool.execute(
      `UPDATE appointments
       SET status            = 'confirmed',
           appointment_date  = proposed_date,
           appointment_time  = proposed_time,
           proposed_date     = NULL,
           proposed_time     = NULL,
           reschedule_reason = NULL,
           updated_at        = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.barber_id) {
      try {
        await barberNotifModel.createNotification(
          appt.barber_id, appt.customer_id, apptId,
          'reschedule_accepted', 'Reschedule Accepted',
          (appt.customer_name || 'Customer') + ' accepted your proposed slot'
        );
      } catch (notifErr) {
        console.error('Notification error (customerAcceptReschedule):', notifErr.message);
      }
    }

    const updated = await getAppointmentById(apptId);
    return res.json({
      message:     'Reschedule accepted. Appointment confirmed for the new time.',
      appointment: updated
    });

  } catch (err) {
    console.error('PUT /api/appointments/:id/reschedule/accept error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/appointments/:id/reschedule/reject
//
// Transition: reschedule_proposed → cancelled
// Customer declines the barber's proposed new time. Appointment is cancelled.
// ─────────────────────────────────────────────────────────────────────────────
async function customerRejectReschedule(req, res) {
  if (!requireCustomer(req, res)) return;

  const customerId = req.customer.customer_id;
  const apptId     = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.customer_id !== customerId)
      return res.status(403).json({ error: 'Access denied.' });

    if (appt.status !== 'reschedule_proposed')
      return res.status(409).json({
        error: `Cannot reject reschedule for appointment with status '${appt.status}'.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status            = 'cancelled',
           proposed_date     = NULL,
           proposed_time     = NULL,
           reschedule_reason = NULL,
           updated_at        = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.barber_id) {
      try {
        await barberNotifModel.createNotification(
          appt.barber_id, appt.customer_id, apptId,
          'reschedule_rejected', 'Reschedule Rejected',
          (appt.customer_name || 'Customer') + ' declined your proposal'
        );
      } catch (notifErr) {
        console.error('Notification error (customerRejectReschedule):', notifErr.message);
      }
    }

    return res.json({
      message:        'Reschedule rejected. Appointment has been cancelled.',
      appointment_id: apptId,
      status:         'cancelled'
    });

  } catch (err) {
    console.error('PUT /api/appointments/:id/reschedule/reject error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/appointments/:id/cancel
//
// Allowed from: pending_approval | pending | confirmed → cancelled
// Customer cancels their own appointment.
// ─────────────────────────────────────────────────────────────────────────────
async function customerCancelAppointment(req, res) {
  if (!requireCustomer(req, res)) return;

  const customerId   = req.customer.customer_id;
  const apptId       = parseApptId(req.params);
  if (!apptId) return res.status(400).json({ error: 'Invalid appointment ID.' });

  // 'pending' included for backward compatibility with existing customer booking route
  const CANCELLABLE = new Set(['pending_approval', 'pending', 'confirmed']);

  try {
    const appt = await getAppointmentById(apptId);

    if (!appt)
      return res.status(404).json({ error: 'Appointment not found.' });

    if (appt.customer_id !== customerId)
      return res.status(403).json({ error: 'Access denied.' });

    if (!CANCELLABLE.has(appt.status))
      return res.status(409).json({
        error: `Cannot cancel an appointment with status '${appt.status}'. Only 'pending_approval' or 'confirmed' appointments can be cancelled.`
      });

    await pool.execute(
      `UPDATE appointments
       SET status = 'cancelled', updated_at = NOW()
       WHERE appointment_id = ?`,
      [apptId]
    );

    if (appt.barber_id) {
      try {
        await barberNotifModel.createNotification(
          appt.barber_id, appt.customer_id, apptId,
          'cancelled', 'Appointment Cancelled',
          (appt.customer_name || 'Customer') + ' cancelled their appointment'
        );
      } catch (notifErr) {
        console.error('Notification error (customerCancelAppointment):', notifErr.message);
      }
    }

    return res.json({
      message:        'Appointment cancelled successfully.',
      appointment_id: apptId,
      status:         'cancelled'
    });

  } catch (err) {
    console.error('PUT /api/appointments/:id/cancel error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  listBarberAppointments,
  acceptAppointment,
  rejectAppointment,
  proposeReschedule,
  completeAppointment,
  markNoShow,
  customerAcceptReschedule,
  customerRejectReschedule,
  customerCancelAppointment
};
