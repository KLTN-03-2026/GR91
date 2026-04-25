import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// Đọc .env thủ công
const env = readFileSync('BE/.env', 'utf8');
const vars = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')));

const conn = await mysql.createConnection({
  host: vars.DB_HOST?.trim() || 'localhost',
  user: vars.DB_USER?.trim() || 'root',
  password: vars.DB_PASSWORD?.trim() || '',
  database: vars.DB_NAME?.trim() || 'smart_hotel',
});

console.log('\n=== INVENTORY BỊ BLOCK (không phải AVAILABLE) ===');
const [inv] = await conn.execute(
  'SELECT room_id, date, status, booking_id FROM room_inventory WHERE status != "AVAILABLE" ORDER BY date LIMIT 30'
);
console.table(inv);

console.log('\n=== BOOKINGS ĐANG ACTIVE ===');
const [bookings] = await conn.execute(
  `SELECT b.booking_id, b.status, b.expires_at, br.room_id, br.check_in, br.check_out
   FROM bookings b
   JOIN booking_rooms br ON b.booking_id = br.booking_id
   WHERE b.status NOT IN ('CANCELLED','COMPLETED')
   ORDER BY b.created_at DESC LIMIT 15`
);
console.table(bookings);

console.log('\n=== BOOKING PENDING QUÁ HẠN (chưa auto-release) ===');
const [expired] = await conn.execute(
  `SELECT booking_id, status, expires_at, NOW() as now_utc
   FROM bookings
   WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < NOW()`
);
console.table(expired);

await conn.end();
