/**
 * Run once: node migrate-expires.mjs
 * Adds expires_at column to bookings table
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'smart_hotel',
});

const conn = await pool.getConnection();
try {
  await conn.execute(`
    ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL DEFAULT NULL
  `);
  console.log('✅ expires_at column added to bookings');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  conn.release();
  await pool.end();
}
