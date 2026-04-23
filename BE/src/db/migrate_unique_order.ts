import { pool } from './client.js';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Adding unique constraint to payment_transactions...');
    await conn.execute('ALTER TABLE payment_transactions ADD UNIQUE KEY unique_order (order_id, gateway)');
    console.log('Unique constraint added successfully.');
  } catch (err: any) {
    if (err.code === 'ER_DUP_KEYNAME') {
      console.log('Unique constraint already exists.');
    } else {
      console.error('Migration failed:', err.message);
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
