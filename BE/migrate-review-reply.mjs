/**
 * Run once: node migrate-review-reply.mjs
 * Adds admin_reply column to reviews table
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
    ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS admin_reply TEXT NULL DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS replied_at  DATETIME NULL DEFAULT NULL
  `);
  console.log('✅ admin_reply + replied_at added to reviews');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  conn.release();
  await pool.end();
}
