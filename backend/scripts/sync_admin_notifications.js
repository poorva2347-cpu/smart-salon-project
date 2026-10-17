'use strict';
// One-time historical sync for admin_notifications.
// Idempotent: safe to run multiple times — uses NOT EXISTS on (type, sub_type, ref_id).
// Run from the backend directory: node scripts/sync_admin_notifications.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../config/db');

async function run() {
  const conn = await pool.getConnection();
  let total = 0;

  try {
    // ── 1. Barbers ─────────────────────────────────────────────────────────────
    // No trigger exists on the barbers table. All barbers (seeded + UI-added)
    // that don't already have a notification row get one here.
    const [r1] = await conn.execute(`
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id, created_at)
      SELECT 'barber', 'added', 'Barber Added',
             CONCAT(barber_name, ' was added to the team.'),
             barber_id, created_at
      FROM barbers b
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_notifications n
        WHERE n.type = 'barber' AND n.sub_type = 'added' AND n.ref_id = b.barber_id
      )
    `);
    console.log('Barbers synced:              ' + r1.affectedRows);
    total += r1.affectedRows;

    // ── 2. Services ────────────────────────────────────────────────────────────
    // No trigger exists on the services table. All services (seeded + UI-added)
    // that don't already have a notification row get one here.
    const [r2] = await conn.execute(`
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id, created_at)
      SELECT 'service', 'added', 'Service Added',
             CONCAT('"', service_name, '" was added to the menu.'),
             service_id, created_at
      FROM services s
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_notifications n
        WHERE n.type = 'service' AND n.sub_type = 'added' AND n.ref_id = s.service_id
      )
    `);
    console.log('Services synced:             ' + r2.affectedRows);
    total += r2.affectedRows;

    // ── 3. Customer registrations ──────────────────────────────────────────────
    // Covers customers who registered before the trigger was active, or if the
    // trigger (trg_adm_notif_customer_reg) was never created in the live DB.
    const [r3] = await conn.execute(`
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id, created_at)
      SELECT 'customer', 'registered', 'New Customer Registered',
             CONCAT(full_name, ' created a new account.'),
             customer_id, created_at
      FROM customers c
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_notifications n
        WHERE n.type = 'customer' AND n.sub_type = 'registered' AND n.ref_id = c.customer_id
      )
    `);
    console.log('Customers synced:            ' + r3.affectedRows);
    total += r3.affectedRows;

    // ── 4. Appointment bookings ────────────────────────────────────────────────
    // Covers appointments booked before the trigger was active, or if the
    // trigger (trg_adm_notif_appt_booked) was never created in the live DB.
    const [r4] = await conn.execute(`
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id, created_at)
      SELECT 'appointment', 'booked', 'New Appointment Booked',
             CONCAT(IFNULL(c.full_name, 'Unknown'), ' booked appointment #', a.appointment_id, '.'),
             a.appointment_id, a.created_at
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.customer_id
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_notifications n
        WHERE n.type = 'appointment' AND n.sub_type = 'booked' AND n.ref_id = a.appointment_id
      )
    `);
    console.log('Appointment bookings synced: ' + r4.affectedRows);
    total += r4.affectedRows;

    // ── 5. Completed appointments ──────────────────────────────────────────────
    // Covers completions recorded before the trigger was active.
    // Uses updated_at as the event time (when status changed), falls back to created_at.
    const [r5] = await conn.execute(`
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id, created_at)
      SELECT 'appointment', 'completed', 'Appointment Completed',
             CONCAT('Appointment #', a.appointment_id, ' for ', IFNULL(c.full_name, 'Unknown'), ' was completed.'),
             a.appointment_id, IFNULL(a.updated_at, a.created_at)
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.customer_id
      WHERE a.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM admin_notifications n
          WHERE n.type = 'appointment' AND n.sub_type = 'completed' AND n.ref_id = a.appointment_id
        )
    `);
    console.log('Completed appointments synced: ' + r5.affectedRows);
    total += r5.affectedRows;

    // ── 6. Cancelled appointments ──────────────────────────────────────────────
    const [r6] = await conn.execute(`
      INSERT INTO admin_notifications (type, sub_type, title, message, ref_id, created_at)
      SELECT 'appointment', 'cancelled', 'Appointment Cancelled',
             CONCAT('Appointment #', a.appointment_id, ' for ', IFNULL(c.full_name, 'Unknown'), ' was cancelled.'),
             a.appointment_id, IFNULL(a.updated_at, a.created_at)
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.customer_id
      WHERE a.status = 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM admin_notifications n
          WHERE n.type = 'appointment' AND n.sub_type = 'cancelled' AND n.ref_id = a.appointment_id
        )
    `);
    console.log('Cancelled appointments synced: ' + r6.affectedRows);
    total += r6.affectedRows;

    console.log('\n' + (total > 0
      ? 'Sync complete. ' + total + ' notification(s) inserted.'
      : 'Nothing to sync — admin_notifications is already up to date.'));

  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
