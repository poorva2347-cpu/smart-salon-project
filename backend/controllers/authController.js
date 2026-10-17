const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
const { findBarberByEmail } = require('../models/barberModel');

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const barber = await findBarberByEmail(email);

    if (!barber) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (barber.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive.' });
    }

    const passwordMatch = await bcrypt.compare(password, barber.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { barber_id: barber.barber_id, email: barber.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    await pool.execute(
      'UPDATE barbers SET last_login = NOW() WHERE barber_id = ?',
      [barber.barber_id]
    );

    return res.json({
      success:  true,
      message:  'Login successful.',
      token,
      barber: {
        barber_id:    barber.barber_id,
        barber_name:  barber.barber_name,
        email:        barber.email,
        phone:        barber.phone,
        image_url:    barber.image_url,
        is_available: barber.is_available
      }
    });

  } catch (err) {
    console.error('Barber login error:', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { login };
