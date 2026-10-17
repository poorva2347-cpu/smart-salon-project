const pool = require('../config/db');

// ─── Time conversion: "2:00 PM" → "14:00:00" (MySQL TIME) ────────────────────
function toMysqlTime(timeStr) {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h        = parseInt(m[1], 10);
  const min    = m[2];
  const period = m[3].toUpperCase();
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${min}:00`;
}

// ─── Date validation helpers ──────────────────────────────────────────────────
function isValidDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s + 'T00:00:00').getTime());
}

function isFutureOrToday(s) {
  const appt  = new Date(s + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return appt >= today;
}

// ─── Valid booking time slots (must match frontend APPT_TIMES) ────────────────
const VALID_TIMES = new Set([
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM',  '2:00 PM',  '3:00 PM',  '4:00 PM',
  '5:00 PM',  '6:00 PM',  '7:00 PM',  '8:00 PM'
]);

// ─── JOIN fragment — barber context includes customer info and reschedule fields
// IMPORTANT: requires columns proposed_date, proposed_time, reschedule_reason
// on the appointments table. Run the schema additions from the Phase 7 report
// before executing any barber appointment queries.
const BARBER_APPT_JOIN = `
  SELECT
    a.appointment_id,
    a.customer_id,
    a.barber_id,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.total_amount,
    a.customer_notes,
    a.proposed_date,
    a.proposed_time,
    a.reschedule_reason,
    a.created_at,
    a.updated_at,
    c.full_name  AS customer_name,
    c.phone      AS customer_phone,
    c.email      AS customer_email,
    b.barber_name,
    asvc.service_id,
    asvc.service_price,
    s.service_name
  FROM appointments a
  LEFT JOIN customers            c    ON a.customer_id    = c.customer_id
  LEFT JOIN barbers              b    ON a.barber_id      = b.barber_id
  LEFT JOIN appointment_services asvc ON a.appointment_id = asvc.appointment_id
  LEFT JOIN services             s    ON asvc.service_id  = s.service_id`;

// ─── Aggregate flat JOIN rows into appointment objects with a services array ──
function aggregateRows(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.appointment_id)) {
      map.set(row.appointment_id, {
        appointment_id:    row.appointment_id,
        customer_id:       row.customer_id,
        barber_id:         row.barber_id,
        barber_name:       row.barber_name       || null,
        customer_name:     row.customer_name      || null,
        customer_phone:    row.customer_phone     || null,
        customer_email:    row.customer_email     || null,
        appointment_date:  row.appointment_date,
        appointment_time:  row.appointment_time,
        status:            row.status,
        total_amount:      parseFloat(row.total_amount),
        customer_notes:    row.customer_notes     || null,
        proposed_date:     row.proposed_date      || null,
        proposed_time:     row.proposed_time      || null,
        reschedule_reason: row.reschedule_reason  || null,
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

// ─── Fetch a single appointment by ID (no ownership filter — caller enforces) ─
async function getAppointmentById(apptId) {
  const [rows] = await pool.execute(
    BARBER_APPT_JOIN + ` WHERE a.appointment_id = ?`,
    [apptId]
  );
  if (rows.length === 0) return null;
  const [appt] = aggregateRows(rows);
  return appt;
}

// ─── Fetch all appointments for a barber, with optional status filter ──────────
async function getBarberAppointments(barberId, statusFilter) {
  let query    = BARBER_APPT_JOIN + ` WHERE a.barber_id = ?`;
  const params = [barberId];

  if (statusFilter) {
    query += ` AND a.status = ?`;
    params.push(statusFilter);
  }

  query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

  const [rows] = await pool.execute(query, params);
  return aggregateRows(rows);
}

async function getAdminAppointments({ status, search, sort } = {}) {
  var conditions = [];
  var params     = [];

  if (status && status !== 'all') {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (search) {
    var like = '%' + String(search).trim() + '%';
    conditions.push(
      '(' +
        'CAST(a.appointment_id AS CHAR) LIKE ? OR ' +
        'c.full_name LIKE ? OR ' +
        'b.barber_name LIKE ? OR ' +
        'a.appointment_id IN (' +
          'SELECT aps2.appointment_id FROM appointment_services aps2 ' +
          'JOIN services s2 ON aps2.service_id = s2.service_id ' +
          'WHERE s2.service_name LIKE ?' +
        ')' +
      ')'
    );
    params.push(like, like, like, like);
  }

  var whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  var orderMap = {
    oldest:           'a.created_at ASC',
    appointment_date: 'a.appointment_date ASC, a.appointment_time ASC',
    customer_name:    'c.full_name ASC'
  };
  var orderBy = orderMap[sort] || 'a.created_at DESC';

  const [rows] = await pool.execute(`
    SELECT
      a.appointment_id,
      DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
      TIME_FORMAT(a.appointment_time, '%H:%i:%s') AS appointment_time,
      a.status,
      a.total_amount,
      a.customer_notes,
      a.created_at,
      IFNULL(c.full_name, 'Unknown')     AS customer_name,
      c.phone                             AS customer_phone,
      IFNULL(b.barber_name, 'Unassigned') AS barber_name,
      IFNULL(GROUP_CONCAT(s.service_name ORDER BY s.service_name SEPARATOR ', '), '—') AS services
    FROM appointments a
    LEFT JOIN customers c   ON a.customer_id    = c.customer_id
    LEFT JOIN barbers b     ON a.barber_id      = b.barber_id
    LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
    LEFT JOIN services s    ON aps.service_id   = s.service_id
    ${whereClause}
    GROUP BY
      a.appointment_id, a.appointment_date, a.appointment_time, a.status,
      a.total_amount, a.customer_notes, a.created_at,
      c.full_name, c.phone, b.barber_name
    ORDER BY ${orderBy}
    LIMIT 200
  `, params);

  return rows;
}

module.exports = {
  pool,
  toMysqlTime,
  isValidDateStr,
  isFutureOrToday,
  VALID_TIMES,
  getAppointmentById,
  getBarberAppointments,
  getAdminAppointments
};
