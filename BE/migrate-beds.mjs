import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'smart_hotel',
});

const conn = await pool.getConnection();
try {
  // Thêm default_capacity vào bed_types (King=2, Double=2, Queen=2, Single=1, Twin=1)
  await conn.execute(`ALTER TABLE bed_types ADD COLUMN IF NOT EXISTS default_capacity INT DEFAULT 2`);
  console.log('✅ Added default_capacity to bed_types');

  // Cập nhật capacity mặc định theo tên
  await conn.execute(`UPDATE bed_types SET default_capacity = 1 WHERE name IN ('Single','Twin')`);
  await conn.execute(`UPDATE bed_types SET default_capacity = 2 WHERE name IN ('Double','Queen','King')`);
  console.log('✅ Updated default_capacity values');

  // Thêm is_extra và extra_price vào room_type_beds
  await conn.execute(`ALTER TABLE room_type_beds ADD COLUMN IF NOT EXISTS is_extra TINYINT(1) DEFAULT 0`);
  await conn.execute(`ALTER TABLE room_type_beds ADD COLUMN IF NOT EXISTS extra_price INT DEFAULT 0`);
  console.log('✅ Added is_extra, extra_price to room_type_beds');

  // Kiểm tra kết quả
  const [bt] = await conn.execute('DESCRIBE bed_types');
  console.log('\nbed_types columns:', bt.map(r => r.Field).join(', '));
  const [rtb] = await conn.execute('DESCRIBE room_type_beds');
  console.log('room_type_beds columns:', rtb.map(r => r.Field).join(', '));
} finally {
  conn.release();
  await pool.end();
}
