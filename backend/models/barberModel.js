const pool = require('../config/db');

async function findBarberByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT * FROM barbers WHERE email = ?',
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function insertBarber({ barber_name, email, phone, password_hash, specialization, experience_years, status }) {
  const [result] = await pool.execute(
    `INSERT INTO barbers
       (barber_name, email, phone, password_hash, specialization, experience_years, status, is_available, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
    [
      barber_name,
      email.toLowerCase(),
      phone             || null,
      password_hash,
      specialization    || null,
      experience_years  != null ? experience_years : null,
      status            || 'active'
    ]
  );
  return result.insertId;
}

async function getAllBarbers() {
  const [rows] = await pool.execute(
    `SELECT b.barber_id, b.barber_name, b.email, b.phone, b.specialization, b.experience_years,
            b.status, b.is_available, b.image_url, b.created_at,
            COUNT(a.appointment_id) AS today_jobs
     FROM barbers b
     LEFT JOIN appointments a
       ON a.barber_id = b.barber_id
       AND a.appointment_date = CURDATE()
       AND a.status IN ('pending', 'pending_approval', 'confirmed', 'completed')
     GROUP BY b.barber_id, b.barber_name, b.email, b.phone, b.specialization, b.experience_years,
              b.status, b.is_available, b.image_url, b.created_at
     ORDER BY b.barber_id ASC`
  );
  return rows;
}

async function findBarberById(id) {
  const [rows] = await pool.execute(
    `SELECT barber_id, barber_name, email, phone, specialization, experience_years, status, is_available, image_url, created_at
     FROM barbers WHERE barber_id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function updateBarberRow(id, { barber_name, email, phone, specialization, experience_years, status }) {
  await pool.execute(
    `UPDATE barbers
     SET barber_name = ?, email = ?, phone = ?, specialization = ?, experience_years = ?, status = ?, updated_at = NOW()
     WHERE barber_id = ?`,
    [barber_name, email.toLowerCase(), phone || null, specialization || null, experience_years, status, id]
  );
}

async function deleteBarberRow(id) {
  await pool.execute('DELETE FROM barbers WHERE barber_id = ?', [id]);
}

async function updateBarberImage(id, imageUrl) {
  await pool.execute(
    'UPDATE barbers SET image_url = ?, updated_at = NOW() WHERE barber_id = ?',
    [imageUrl, id]
  );
}

async function barberHasAppointments(id) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS cnt FROM appointments WHERE barber_id = ?',
    [id]
  );
  return rows[0].cnt > 0;
}

module.exports = { findBarberByEmail, insertBarber, getAllBarbers, findBarberById, updateBarberRow, updateBarberImage, deleteBarberRow, barberHasAppointments };
