import { pool } from './client.js';

const sqls = [
  "ALTER TABLE bookings ADD COLUMN paid_amount INT DEFAULT 0 AFTER total_price",
  "ALTER TABLE bookings ADD COLUMN remaining_amount INT DEFAULT 0 AFTER paid_amount",
  "UPDATE bookings SET remaining_amount = total_price - paid_amount",
  "ALTER TABLE payment_transactions ADD COLUMN gateway VARCHAR(50) DEFAULT 'CASH' AFTER method",
  "ALTER TABLE payment_transactions ADD COLUMN order_id VARCHAR(100) NULL AFTER gateway",
  "ALTER TABLE payment_transactions ADD COLUMN trans_id VARCHAR(100) NULL AFTER order_id",
  `CREATE TABLE IF NOT EXISTS payment_logs (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    booking_id  INT,
    gateway     VARCHAR(50),
    action      VARCHAR(100),
    raw_data    JSON,
    status      VARCHAR(50), 
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
  )`
];

async function runMigration() {
  console.log('Starting VNPay migration...');
  const conn = await pool.getConnection();
  try {
    for (const sql of sqls) {
      console.log(`Executing: ${sql.substring(0, 50)}...`);
      try {
        await conn.execute(sql);
      } catch (err: any) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column already exists, skipping.');
        } else {
            console.warn('Skipping error:', err.message);
        }
      }
    }
    console.log('VNPay migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration();
