'use strict';
// Ensures the three admin_notifications triggers exist in the live database.
// Uses DROP + CREATE so it's safe to re-run — existing triggers are replaced cleanly.
// Run from the backend directory: node scripts/ensure_triggers.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../config/db');

const TRIGGERS = [
  {
    name: 'trg_adm_notif_customer_reg',
    sql: `
      CREATE TRIGGER trg_adm_notif_customer_reg
      AFTER INSERT ON customers
      FOR EACH ROW
      BEGIN
        INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
        VALUES ('customer', 'registered', 'New Customer Registered',
                CONCAT(NEW.full_name, ' created a new account.'), NEW.customer_id);
      END
    `
  },
  {
    name: 'trg_adm_notif_appt_booked',
    sql: `
      CREATE TRIGGER trg_adm_notif_appt_booked
      AFTER INSERT ON appointments
      FOR EACH ROW
      BEGIN
        DECLARE v_cname VARCHAR(100) DEFAULT 'Unknown';
        SELECT IFNULL(full_name, 'Unknown') INTO v_cname
          FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
        INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
        VALUES ('appointment', 'booked', 'New Appointment Booked',
                CONCAT(v_cname, ' booked appointment #', NEW.appointment_id, '.'),
                NEW.appointment_id);
      END
    `
  },
  {
    name: 'trg_adm_notif_appt_update',
    sql: `
      CREATE TRIGGER trg_adm_notif_appt_update
      AFTER UPDATE ON appointments
      FOR EACH ROW
      BEGIN
        DECLARE v_cname VARCHAR(100) DEFAULT 'Unknown';
        IF NEW.status != OLD.status THEN
          SELECT IFNULL(full_name, 'Unknown') INTO v_cname
            FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
          IF NEW.status = 'completed' THEN
            INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
            VALUES ('appointment', 'completed', 'Appointment Completed',
                    CONCAT('Appointment #', NEW.appointment_id, ' for ', v_cname, ' was completed.'),
                    NEW.appointment_id);
          ELSEIF NEW.status = 'cancelled' THEN
            INSERT INTO admin_notifications (type, sub_type, title, message, ref_id)
            VALUES ('appointment', 'cancelled', 'Appointment Cancelled',
                    CONCAT('Appointment #', NEW.appointment_id, ' for ', v_cname, ' was cancelled.'),
                    NEW.appointment_id);
          END IF;
        END IF;
      END
    `
  }
];

async function run() {
  const conn = await pool.getConnection();
  try {
    for (const t of TRIGGERS) {
      await conn.query('DROP TRIGGER IF EXISTS `' + t.name + '`');
      await conn.query(t.sql);
      console.log('Trigger created: ' + t.name);
    }
    console.log('\nAll triggers are in place.');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Trigger setup failed:', err.message);
  process.exit(1);
});
