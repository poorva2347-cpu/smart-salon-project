const pool = require('../config/db');

async function getAllServices() {
  const [rows] = await pool.execute(`
    SELECT
      s.service_id,
      s.service_name,
      s.description,
      s.price,
      s.duration_minutes,
      s.status,
      COUNT(aps.id) AS booking_count
    FROM services s
    LEFT JOIN appointment_services aps ON s.service_id = aps.service_id
    GROUP BY s.service_id, s.service_name, s.description, s.price, s.duration_minutes, s.status
    ORDER BY s.service_id ASC
  `);
  return rows;
}

async function findServiceById(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM services WHERE service_id = ?',
    [id]
  );
  return rows[0] || null;
}

async function findServiceByName(name, excludeId = null) {
  if (excludeId !== null) {
    const [rows] = await pool.execute(
      'SELECT * FROM services WHERE LOWER(service_name) = LOWER(?) AND service_id != ?',
      [String(name).trim(), excludeId]
    );
    return rows[0] || null;
  }
  const [rows] = await pool.execute(
    'SELECT * FROM services WHERE LOWER(service_name) = LOWER(?)',
    [String(name).trim()]
  );
  return rows[0] || null;
}

async function insertService(data) {
  const { service_name, description, price, duration_minutes, status } = data;
  const [result] = await pool.execute(
    `INSERT INTO services (service_name, description, price, duration_minutes, status)
     VALUES (?, ?, ?, ?, ?)`,
    [service_name, description || null, price, duration_minutes, status]
  );
  return result.insertId;
}

async function updateServiceRow(id, data) {
  const { service_name, description, price, duration_minutes, status } = data;
  await pool.execute(
    `UPDATE services
     SET service_name = ?, description = ?, price = ?, duration_minutes = ?, status = ?
     WHERE service_id = ?`,
    [service_name, description || null, price, duration_minutes, status, id]
  );
}

async function deleteServiceRow(id) {
  await pool.execute('DELETE FROM services WHERE service_id = ?', [id]);
}

async function serviceHasBookings(id) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM appointment_services WHERE service_id = ?',
    [id]
  );
  return Number(rows[0].cnt) > 0;
}

module.exports = {
  getAllServices,
  findServiceById,
  findServiceByName,
  insertService,
  updateServiceRow,
  deleteServiceRow,
  serviceHasBookings
};
