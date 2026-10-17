const express           = require('express');
const bcrypt            = require('bcrypt');
const pool              = require('../config/db');
const authenticate      = require('../middleware/auth');
const uploadBarberImage = require('../middleware/uploadBarberImage');
const barberModel       = require('../models/barberModel');

const router = express.Router();

// Columns returned for every profile response — password_hash is never included
const PROFILE_COLS = `
  customer_id, full_name, email, phone,
  profile_image, account_status, created_at, last_login
`;

// ──────────────────────────────────────────────
// GET /profile
// Returns the logged-in customer's profile data.
// ──────────────────────────────────────────────
router.get('/profile', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${PROFILE_COLS} FROM customers
       WHERE customer_id = ? AND account_status != 'deleted'`,
      [req.customer.customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    return res.json({ profile: rows[0] });

  } catch (err) {
    console.error('GET /profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// PUT /profile
// Updates full_name, phone, and profile_image.
// Email, password, and account_status are not writable here.
// ──────────────────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  const { full_name, phone, profile_image } = req.body;

  if (!full_name || !full_name.trim()) {
    return res.status(400).json({ error: 'full_name is required.' });
  }

  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'phone is required.' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE customers
       SET full_name = ?, phone = ?, profile_image = ?, updated_at = NOW()
       WHERE customer_id = ? AND account_status != 'deleted'`,
      [
        full_name.trim(),
        phone.trim(),
        profile_image || null,
        req.customer.customer_id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const [rows] = await pool.execute(
      `SELECT ${PROFILE_COLS} FROM customers WHERE customer_id = ?`,
      [req.customer.customer_id]
    );

    return res.json({
      message: 'Profile updated successfully.',
      profile: rows[0]
    });

  } catch (err) {
    console.error('PUT /profile error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// PUT /profile/password
// Verifies current password, then saves new hash.
// ──────────────────────────────────────────────
router.put('/profile/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'currentPassword is required.' });
  }

  if (!newPassword) {
    return res.status(400).json({ error: 'newPassword is required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT password_hash FROM customers
       WHERE customer_id = ? AND account_status != 'deleted'`,
      [req.customer.customer_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool.execute(
      `UPDATE customers
       SET password_hash = ?, updated_at = NOW()
       WHERE customer_id = ?`,
      [newHash, req.customer.customer_id]
    );

    return res.json({ message: 'Password updated successfully.' });

  } catch (err) {
    console.error('PUT /profile/password error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ──────────────────────────────────────────────
// PUT /api/barber/profile/photo
// Uploads a new profile image for the authenticated barber,
// stores it on disk, and updates barbers.image_url.
// ──────────────────────────────────────────────
router.put('/api/barber/profile/photo', authenticate, (req, res) => {
  if (!req.user || !req.user.barber_id) {
    return res.status(403).json({ error: 'Barber authentication required.' });
  }

  uploadBarberImage.single('image')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be smaller than 2 MB.'
        : (err.message || 'Failed to upload image.');
      return res.status(400).json({ error: message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'An image file is required.' });
    }

    try {
      const barberId = req.user.barber_id;
      const imageUrl = '/uploads/barbers/' + req.file.filename;

      await barberModel.updateBarberImage(barberId, imageUrl);
      const barber = await barberModel.findBarberById(barberId);

      return res.json({
        message: 'Profile image updated successfully.',
        barber
      });

    } catch (dbErr) {
      console.error('PUT /api/barber/profile/photo error:', dbErr.message);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  });
});

module.exports = router;
