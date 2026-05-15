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

  // 10. room_prices (giá override theo ngày cho từng phòng)
  `CREATE TABLE IF NOT EXISTS room_prices (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    date    DATE,
    price   DECIMAL(10,2),
    UNIQUE (room_id, date),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  )`,

  // 11. room_type_prices (giá override theo ngày cho loại phòng)
  `CREATE TABLE IF NOT EXISTS room_type_prices (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    type_id INT,
    date    DATE,
    price   DECIMAL(10,2),
    FOREIGN KEY (type_id) REFERENCES room_types(type_id) ON DELETE CASCADE
  )`,

  // 12. pricing_rules (quy tắc giá theo giờ check-in/out)
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

  // 13. users
  `CREATE TABLE IF NOT EXISTS users (
    user_id    INT AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(50) UNIQUE,
    password   VARCHAR(255),
    full_name  VARCHAR(255),
    email      VARCHAR(255),
    phone      VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 14. roles
  `CREATE TABLE IF NOT EXISTS roles (
    role_id   INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE
  )`,

  // 15. user_roles
  `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT,
    role_id INT,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)  ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)  ON DELETE CASCADE
  )`,

  // 16. bookings
  `CREATE TABLE IF NOT EXISTS bookings (
    booking_id       INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT,
    total_price      INT,
    paid_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status           ENUM('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','PARTIALLY_PAID') NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at       DATETIME NULL DEFAULT NULL,
    payment_policy   ENUM('FULL','DEPOSIT','PAY_AT_HOTEL') NOT NULL DEFAULT 'FULL',
    guarantee_type   ENUM('NONE','CARD_HOLD') DEFAULT 'NONE',
    no_show_fee      DECIMAL(12,2) DEFAULT 0.00,
    KEY idx_booking_user (user_id),
    KEY idx_bookings_payment_policy (payment_policy),
    KEY idx_bookings_status_payment (status, payment_policy),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
  )`,

  // 17. booking_rooms
  `CREATE TABLE IF NOT EXISTS booking_rooms (
    booking_room_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id      INT,
    room_id         INT,
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    price           INT,
    check_in_time   TIME NULL,
    check_out_time  TIME NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id)    REFERENCES rooms(room_id)
  )`,

  // 18. booking_guests
  `CREATE TABLE IF NOT EXISTS booking_guests (
    booking_guest_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT,
    full_name        VARCHAR(255),
    phone            VARCHAR(20),
    email            VARCHAR(255),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
  )`,

  // 19. room_inventory
  `CREATE TABLE IF NOT EXISTS room_inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id      INT,
    date         DATE NOT NULL,
    is_available TINYINT(1) DEFAULT 1,
    price        INT,
    status       ENUM('AVAILABLE','PENDING','BOOKED','BLOCKED') DEFAULT 'AVAILABLE',
    booking_id   INT NULL,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_room_date (room_id, date),
    KEY idx_inventory_available (is_available, date),
    KEY idx_room_date_status (room_id, date, status),
    KEY idx_booking_id (booking_id),
    FOREIGN KEY (room_id)    REFERENCES rooms(room_id)    ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
  )`,

  // 20. payment_transactions
  `CREATE TABLE IF NOT EXISTS payment_transactions (
    payment_id       INT AUTO_INCREMENT PRIMARY KEY,
    booking_id       INT,
    amount           INT,
    method           VARCHAR(50),
    gateway          ENUM('momo','vnpay','cash') DEFAULT 'cash',
    type             ENUM('FULL','DEPOSIT','REMAINING') NOT NULL DEFAULT 'FULL',
    idempotency_key  VARCHAR(100) NULL,
    partner_code     VARCHAR(50) NULL,
    order_id         VARCHAR(100) NULL,
    request_id       VARCHAR(100) NULL,
    trans_id         BIGINT NULL,
    pay_url          TEXT,
    deeplink         TEXT,
    qr_code_url      TEXT,
    result_code      INT NULL,
    momo_message     VARCHAR(255) NULL,
    response_time    TIMESTAMP NULL DEFAULT NULL,
    signature        TEXT,
    status           ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_unique_order_id (order_id),
    UNIQUE KEY idx_unique_request_id (request_id),
    UNIQUE KEY unique_order (order_id, gateway),
    KEY idx_idempotency_key (idempotency_key),
    KEY idx_momo_order_id (order_id),
    KEY idx_momo_request_id (request_id),
    KEY idx_momo_trans_id (trans_id),
    KEY idx_payment_gateway_status (gateway, status),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
  )`,

  // 21. reviews
  `CREATE TABLE IF NOT EXISTS reviews (
    review_id    INT AUTO_INCREMENT PRIMARY KEY,
    booking_id   INT,
    user_id      INT,
    room_type_id INT NOT NULL,
    rating       INT CHECK (rating >= 1 AND rating <= 5),
    comment      TEXT,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status       ENUM('VISIBLE','HIDDEN') DEFAULT 'VISIBLE',
    UNIQUE KEY unique_review (user_id, booking_id),
    FOREIGN KEY (booking_id)   REFERENCES bookings(booking_id),
    FOREIGN KEY (user_id)      REFERENCES users(user_id),
    FOREIGN KEY (room_type_id) REFERENCES room_types(type_id) ON DELETE CASCADE
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

  // 25. payment_logs
  `CREATE TABLE IF NOT EXISTS payment_logs (
    log_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id   INT NOT NULL,
    event_type   ENUM('INITIATE','WEBHOOK_RECEIVED','WEBHOOK_VERIFIED','SUCCESS','FAILED','REFUND') NOT NULL,
    status       ENUM('PENDING','SUCCESS','FAILED') NOT NULL,
    message      TEXT,
    gateway_data JSON DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_payment_logs_payment_id (payment_id),
    KEY idx_payment_logs_created (created_at),
    KEY idx_payment_logs_event (event_type),
    FOREIGN KEY (payment_id) REFERENCES payment_transactions(payment_id) ON DELETE CASCADE
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
