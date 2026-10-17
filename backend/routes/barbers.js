const express = require('express');
const pool    = require('../config/db');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /barbers
// Returns all active barbers ordered by barber_id.
// Public — no authentication required.
// ──────────────────────────────────────────────
router.get('/barbers', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT barber_id, barber_name, specialization, experience_years,
              image_url, is_available, status
       FROM barbers
       WHERE status = 'active'
       ORDER BY barber_id ASC`
    );

    return res.json({ barbers: rows });

  } catch (err) {
    console.error('GET /barbers error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
