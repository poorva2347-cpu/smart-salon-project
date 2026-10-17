const express = require('express');
const pool    = require('../config/db');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /services
// Returns all active services ordered by service_id.
// Public — no authentication required.
// ──────────────────────────────────────────────
router.get('/services', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT service_id, service_name, description, price,
              duration_minutes, image_url, status
       FROM services
       WHERE status = 'active'
       ORDER BY service_id ASC`
    );

    return res.json({ services: rows });

  } catch (err) {
    console.error('GET /services error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
