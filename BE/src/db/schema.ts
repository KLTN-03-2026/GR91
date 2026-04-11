/**
 * Run: npm run db:init
 * Tạo toàn bộ bảng theo schema smart_hotel
 */
import 'dotenv/config';
import { pool } from './client.js';

const statements = [
  // 1. hotel_info
  `CREATE TABLE IF NOT EXISTS hotel_info (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    phone       VARCHAR(20),
    email       VARCHAR(255),
    description TEXT
  )`,

  // 2. room_categories
  `CREATE TABLE IF NOT EXISTS room_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50),
    description TEXT
  )`,

  // 3. room_types
  `CREATE TABLE IF NOT EXISTS room_types (
    type_id     INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    base_price  INT NOT NULL,
    capacity    INT DEFAULT 2,
    category_id INT NULL,
    area_sqm    INT DEFAULT 20,
    FOREIGN KEY (category_id) REFERENCES room_categories(category_id)
  )`,

  // 4. amenities
  `CREATE TABLE IF NOT EXISTS amenities (
    amenity_id INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL
  )`,

  // 5. room_type_amenities
  `CREATE TABLE IF NOT EXISTS room_type_amenities (
    type_id    INT,
    amenity_id INT,
    PRIMARY KEY (type_id, amenity_id),
    FOREIGN KEY (type_id)    REFERENCES room_types(type_id)  ON DELETE CASCADE,
    FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id) ON DELETE CASCADE
  )`,

  // 6. bed_types
  `CREATE TABLE IF NOT EXISTS bed_types (
    bed_id INT AUTO_INCREMENT PRIMARY KEY,
    name   VARCHAR(50)
  )`,

  // 7. room_type_beds
  `CREATE TABLE IF NOT EXISTS room_type_beds (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    type_id  INT,
    bed_id   INT,
    quantity INT,
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE CASCADE,
    FOREIGN KEY (bed_id)  REFERENCES bed_types(bed_id)   ON DELETE CASCADE
  )`,

  // 8. rooms
  `CREATE TABLE IF NOT EXISTS rooms (
    room_id     INT AUTO_INCREMENT PRIMARY KEY,
    type_id     INT,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    floor       INT,
    status      ENUM('ACTIVE','INACTIVE','MAINTENANCE','CLEANING') DEFAULT 'ACTIVE',
    room_note   MEDIUMTEXT,
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE SET NULL
  )`,

  // 9. room_images
  `CREATE TABLE IF NOT EXISTS room_images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id  INT,
    url      MEDIUMTEXT,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  )`,

  // 10. room_inventory
  `CREATE TABLE IF NOT EXISTS room_inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id      INT,
    date         DATE NOT NULL,
    is_available TINYINT(1) DEFAULT 1,
    price        INT,
    UNIQUE (room_id, date),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  )`,

  // 11. room_prices (giá override theo ngày cho từng phòng)
  `CREATE TABLE IF NOT EXISTS room_prices (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    date    DATE,
    price   DECIMAL(10,2),
    UNIQUE (room_id, date),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  )`,

  // 12. room_type_prices (giá override theo ngày cho loại phòng)
  `CREATE TABLE IF NOT EXISTS room_type_prices (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    type_id INT,
    date    DATE,
    price   DECIMAL(10,2),
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE CASCADE
  )`,

  // 13. pricing_rules (quy tắc giá theo giờ check-in/out)
  `CREATE TABLE IF NOT EXISTS pricing_rules (
    rule_id     INT AUTO_INCREMENT PRIMARY KEY,
    rule_type   ENUM('checkin','checkout') NOT NULL,
    start_hour  INT NOT NULL,
    end_hour    INT NOT NULL,
    percent     DECIMAL(5,2) NOT NULL,
    description VARCHAR(255),
    is_active   TINYINT(1) DEFAULT 1,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 14. users
  `CREATE TABLE IF NOT EXISTS users (
    user_id    INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50) UNIQUE,
    password   VARCHAR(255),
    full_name  VARCHAR(255),
    email      VARCHAR(255),
    phone      VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 15. roles
  `CREATE TABLE IF NOT EXISTS roles (
    role_id   INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE
  )`,

  // 16. user_roles
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)  ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)  ON DELETE CASCADE
  )`,

  // 17. bookings
  `CREATE TABLE IF NOT EXISTS bookings (
    booking_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    total_price INT,
    status      ENUM('PENDING','CONFIRMED','COMPLETED','CANCELLED') DEFAULT 'PENDING',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
  )`,

  // 18. booking_rooms
  `CREATE TABLE IF NOT EXISTS booking_rooms (
    booking_room_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id      INT,
    room_id         INT,
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    price           INT,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id)    REFERENCES rooms(room_id)
  )`,

  // 19. booking_guests
  `CREATE TABLE IF NOT EXISTS booking_guests (
    booking_guest_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT,
    full_name        VARCHAR(255),
    phone            VARCHAR(20),
    email            VARCHAR(255),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
  )`,

  // 20. payment_transactions
  `CREATE TABLE IF NOT EXISTS payment_transactions (
    payment_id       INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT,
    amount           INT,
    method           VARCHAR(50),
    status           ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
  )`,

  // 21. reviews
  `CREATE TABLE IF NOT EXISTS reviews (
    review_id  INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT,
    user_id    INT,
    rating     INT CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (user_id)    REFERENCES users(user_id)
  )`,

  // 22. chatbot_sessions
  `CREATE TABLE IF NOT EXISTS chatbot_sessions (
    session_id VARCHAR(100) PRIMARY KEY,
    user_id    INT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
  )`,

  // 23. chatbot_messages
  `CREATE TABLE IF NOT EXISTS chatbot_messages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100),
    sender     ENUM('USER','BOT'),
    message    TEXT,
    sent_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chatbot_sessions(session_id) ON DELETE CASCADE
  )`,

  // 24. activity_logs
  `CREATE TABLE IF NOT EXISTS activity_logs (
    log_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT,
    action     VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
  )`,
];

async function initSchema() {
  const conn = await pool.getConnection();
  try {
    for (const sql of statements) {
      await conn.execute(sql);
    }
    console.log('Schema initialized successfully.');
  } finally {
    conn.release();
    await pool.end();
  }
}

initSchema().catch(console.error);
