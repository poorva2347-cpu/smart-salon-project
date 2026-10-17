const pool = require('../config/db');

async function findAdminByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT * FROM admins WHERE email = ?',
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function findAdminById(id) {
  const [rows] = await pool.execute(
    'SELECT * FROM admins WHERE admin_id = ?',
    [id]
  );
  return rows[0] || null;
}

async function isEmailTakenByOther(email, excludeId) {
  const [rows] = await pool.execute(
    'SELECT admin_id FROM admins WHERE email = ? AND admin_id != ?',
    [email.toLowerCase(), excludeId]
  );
  return rows.length > 0;
}

async function updateAdminRow(id, { full_name, email }) {
  await pool.execute(
    'UPDATE admins SET full_name = ?, email = ?, updated_at = NOW() WHERE admin_id = ?',
    [full_name, email.toLowerCase(), id]
  );
}

async function updateAdminPassword(id, passwordHash) {
  await pool.execute(
    'UPDATE admins SET password_hash = ?, updated_at = NOW() WHERE admin_id = ?',
    [passwordHash, id]
  );
}

module.exports = { findAdminByEmail, findAdminById, isEmailTakenByOther, updateAdminRow, updateAdminPassword };
