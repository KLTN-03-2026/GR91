/**
 * Run: npm run db:seed
 * Chèn dữ liệu demo vào database
 */
import 'dotenv/config';
import { pool } from './client.js';

async function seed() {
  const conn = await pool.getConnection();
  try {
    // hotel_info
    await conn.execute(`
      INSERT IGNORE INTO hotel_info (id, name, address, phone, email, description) VALUES
      (1, 'Sunrise Smart Hotel', 'TP ĐÀ NẴNG',
       '0774423506', 'nhieu1652004@gmail.com',
       'Khách sạn tích hợp AI đầu tiên tại Việt Nam.')
      ON DUPLICATE KEY UPDATE 
        address = VALUES(address),
        phone = VALUES(phone),
        email = VALUES(email)
    `);

    // room_types
    await conn.execute(`
      INSERT IGNORE INTO room_types (type_id, name, description, base_price, capacity) VALUES
      (1, 'Standard', 'Phòng cơ bản tiện nghi đầy đủ', 500000, 2),
      (2, 'Superior', 'Phòng cao cấp hơn Standard', 800000, 2),
      (3, 'Deluxe',   'Phòng cao cấp view phố',      1200000, 2),
      (4, 'Suite',    'Phòng suite sang trọng',       2500000, 3),
      (5, 'Villa',    'Villa riêng biệt',             5000000, 4)
    `);

    // amenities
    await conn.execute(`
      INSERT IGNORE INTO amenities (amenity_id, name) VALUES
      (1, 'Wifi miễn phí'),
      (2, 'Điều hòa'),
      (3, 'Smart TV'),
      (4, 'Mini bar'),
      (5, 'Bữa sáng buffet'),
      (6, 'Hồ bơi'),
      (7, 'Spa'),
      (8, 'Phòng Gym'),
      (9, 'Bồn tắm nằm'),
      (10, 'AI Assistant')
    `);

    // room_type_amenities
    await conn.execute(`
      INSERT IGNORE INTO room_type_amenities (type_id, amenity_id) VALUES
      (1,1),(1,2),(1,3),
      (2,1),(2,2),(2,3),(2,4),
      (3,1),(3,2),(3,3),(3,4),(3,5),
      (4,1),(4,2),(4,3),(4,4),(4,5),(4,9),
      (5,1),(5,2),(5,3),(5,4),(5,5),(5,6),(5,7),(5,9)
    `);

    // roles
    await conn.execute(`
      INSERT IGNORE INTO roles (role_id, role_name) VALUES
      (1, 'ADMIN'), (2, 'STAFF'), (3, 'USER')
    `);

    // rooms
    await conn.execute(`
      INSERT IGNORE INTO rooms (room_id, type_id, room_number, floor, status) VALUES
      (1, 3, '101', 1, 'ACTIVE'),
      (2, 3, '102', 1, 'ACTIVE'),
      (3, 4, '201', 2, 'ACTIVE'),
      (4, 4, '202', 2, 'ACTIVE'),
      (5, 1, '301', 3, 'ACTIVE'),
      (6, 1, '302', 3, 'ACTIVE'),
      (7, 5, '401', 4, 'ACTIVE')
    `);

    // room_images
    await conn.execute(`
      INSERT IGNORE INTO room_images (room_id, url) VALUES
      (1, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'),
      (2, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'),
      (3, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'),
      (4, 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80')
    `);

    console.log('Seed completed successfully.');
  } finally {
    conn.release();
    await pool.end();
  }
}

seed().catch(console.error);
