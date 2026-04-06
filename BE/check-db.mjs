import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env' });

const pool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 3306),
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'smart_hotel',
});

const conn = await pool.getConnection();
try {
  const [ping] = await conn.execute('SELECT 1 AS ok');
  console.log('✅ CONNECTION OK');

  const [tables] = await conn.execute('SHOW TABLES');
  console.log('\n📋 TABLES IN smart_hotel (' + tables.length + ' tables):');
  tables.forEach((t, i) => console.log('  ' + (i+1) + '. ' + Object.values(t)[0]));

  const checkTables = ['room_types','rooms','room_prices','room_type_prices','room_categories','bed_types','room_type_beds','pricing_rules','room_inventory','bookings','booking_rooms','booking_guests','payment_transactions','users','reviews','room_images','activity_logs','chatbot_sessions','chatbot_messages'];
  for (const tbl of checkTables) {
    try {
      const [cols] = await conn.execute('DESCRIBE ' + tbl);
      console.log('\n-- ' + tbl + ' (' + cols.length + ' cols) --');
      cols.forEach(c => console.log('  ' + c.Field.padEnd(20) + c.Type.padEnd(25) + (c.Key ? '[' + c.Key + ']' : '')));
    } catch(e) {
      console.log('\n-- ' + tbl + ' -- ❌ NOT FOUND');
    }
  }
} finally {
  conn.release();
  await pool.end();
}
