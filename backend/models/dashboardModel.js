const pool = require('../config/db');

async function getDashboardStats() {
  const [rows] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM customers)  AS total_customers,
      (SELECT COUNT(*) FROM barbers)    AS total_barbers,
      (SELECT COUNT(*) FROM services)   AS total_services,
      (SELECT COUNT(*) FROM appointments) AS total_appointments,
      (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE()) AS today_appointments,
      (SELECT COUNT(*) FROM appointments WHERE status IN ('pending','pending_approval')) AS pending_appointments,
      (SELECT COUNT(*) FROM appointments WHERE status = 'completed') AS completed_appointments,
      (SELECT COUNT(*) FROM barbers WHERE status = 'active') AS active_barbers,
      (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE() AND status IN ('pending','pending_approval')) AS today_pending,
      (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE() AND status = 'confirmed')  AS today_confirmed,
      (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE() AND status = 'completed')  AS today_completed,
      (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURDATE() AND status = 'cancelled')  AS today_cancelled,
      (SELECT full_name  FROM customers ORDER BY created_at DESC LIMIT 1) AS latest_customer_name,
      (SELECT created_at FROM customers ORDER BY created_at DESC LIMIT 1) AS latest_customer_created_at
  `);
  return rows[0];
}

async function getWeeklyChart() {
  const [rows] = await pool.execute(`
    SELECT
      DATE(appointment_date) AS appt_date,
      COUNT(*) AS count
    FROM appointments
    WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      AND appointment_date <= CURDATE()
    GROUP BY appt_date
    ORDER BY appt_date ASC
  `);
  return rows;
}

async function getTopBarbers() {
  const [rows] = await pool.execute(`
    SELECT
      b.barber_id,
      b.barber_name,
      b.specialization,
      COUNT(a.appointment_id) AS total_jobs
    FROM barbers b
    LEFT JOIN appointments a ON b.barber_id = a.barber_id AND a.status = 'completed'
    GROUP BY b.barber_id, b.barber_name, b.specialization
    ORDER BY total_jobs DESC
    LIMIT 5
  `);
  return rows;
}

async function getRecentActivity() {
  const [rows] = await pool.execute(`
    (
      SELECT
        'customer'   AS type,
        'registered' AS sub_type,
        'Customer Registered' AS title,
        CONCAT(full_name, ' created an account.') AS message,
        created_at
      FROM customers
    )
    UNION ALL
    (
      SELECT
        'barber' AS type,
        'added'  AS sub_type,
        'Barber Joined' AS title,
        CONCAT(barber_name, ' joined the salon.') AS message,
        created_at
      FROM barbers
    )
    UNION ALL
    (
      SELECT
        'appointment' AS type,
        'booked'      AS sub_type,
        'Appointment Booked' AS title,
        CONCAT(
          IFNULL(c.full_name, 'A customer'), ' booked ',
          IFNULL(
            (SELECT GROUP_CONCAT(sv.service_name ORDER BY sv.service_name SEPARATOR ' & ')
             FROM appointment_services aps
             JOIN services sv ON aps.service_id = sv.service_id
             WHERE aps.appointment_id = a.appointment_id),
            'an appointment'
          ), '.'
        ) AS message,
        a.created_at
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.customer_id
    )
    UNION ALL
    (
      SELECT
        'appointment' AS type,
        'completed'   AS sub_type,
        'Appointment Completed' AS title,
        CONCAT('Appointment #', appointment_id, ' was completed.') AS message,
        updated_at AS created_at
      FROM appointments
      WHERE status = 'completed'
    )
    UNION ALL
    (
      SELECT
        'appointment' AS type,
        'cancelled'   AS sub_type,
        'Appointment Cancelled' AS title,
        CONCAT('Appointment #', appointment_id, ' was cancelled.') AS message,
        updated_at AS created_at
      FROM appointments
      WHERE status = 'cancelled'
    )
    ORDER BY created_at DESC
    LIMIT 8
  `);
  return rows;
}

async function getTopServices() {
  const [rows] = await pool.execute(`
    SELECT
      s.service_name,
      COUNT(aps.id) AS booking_count
    FROM services s
    LEFT JOIN appointment_services aps ON s.service_id = aps.service_id
    WHERE s.status = 'active'
    GROUP BY s.service_id, s.service_name
    ORDER BY booking_count DESC
    LIMIT 5
  `);
  return rows;
}

module.exports = { getDashboardStats, getWeeklyChart, getTopBarbers, getRecentActivity, getTopServices };
