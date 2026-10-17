const express        = require('express');
const bcrypt         = require('bcrypt');
const jwt            = require('jsonwebtoken');
const pool           = require('../config/db');
const authController = require('../controllers/authController');

const router = express.Router();

// POST /api/auth/login — Barber login
router.post('/api/auth/login', authController.login);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /register
router.post('/register', async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required.' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT customer_id FROM customers WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [full_name, email.toLowerCase(), phone || null, password_hash]
    );

    return res.status(201).json({
      message:     'Registration successful.',
      customer_id: result.insertId
    });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT customer_id, email, password_hash, account_status FROM customers WHERE email = ?',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const customer = rows[0];

    if (customer.account_status === 'deleted') {
      return res.status(403).json({ error: 'Account not found.' });
    }

    if (customer.account_status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended.' });
    }

    const passwordMatch = await bcrypt.compare(password, customer.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await pool.execute(
      'UPDATE customers SET last_login = NOW() WHERE customer_id = ?',
      [customer.customer_id]
    );

    const token = jwt.sign(
      { customer_id: customer.customer_id, email: customer.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message:     'Login successful.',
      token,
      customer_id: customer.customer_id,
      email:       customer.email
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/barber/change-password — barber-authenticated
router.patch('/api/barber/change-password', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  let payload;
  try {
    payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    if (!payload.barber_id) {
      return res.status(403).json({ success: false, message: 'Invalid token.' });
    }
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT password_hash FROM barbers WHERE barber_id = ?',
      [payload.barber_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Barber not found.' });
    }

    const match = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash   = await bcrypt.hash(new_password, 10);
    const [result]  = await pool.execute(
      'UPDATE barbers SET password_hash = ? WHERE barber_id = ?',
      [newHash, payload.barber_id]
    );
    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, message: 'Password update failed.' });
    }

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

module.exports = router;
