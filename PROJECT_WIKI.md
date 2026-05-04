# SMARTHOTEL — PROJECT WIKI

> Tài liệu tổng hợp toàn bộ dự án: kiến trúc, file, API, component, database, business logic, flow.

---

## 1. TECH STACK

| Layer | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, React Router v7, Tailwind CSS v4, Framer Motion, Lucide React |
| Backend | Node.js, Express 4, TypeScript, tsx (dev runner) |
| Database | MySQL 8 (mysql2/promise, connection pool) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| AI Chatbot | Ollama (Llama-3.2-3b), LangChain, LangGraph — Local LLM Pipeline |
| Payment | VNPay Sandbox (vnpay SDK v2.5.0) |
| Dev Tools | tsx watch, tsc, vite build |

**Ports:** Backend `4000` · Frontend `3000`  
**CORS:** BE cho phép origin `localhost:3000` và `localhost:5173`

---

## 2. KIẾN TRÚC HỆ THỐNG

```
[Browser]
    |
    | HTTP/REST (VITE_API_URL = http://localhost:4000/api)
    v
[FE - React/Vite :3000]
    |  localStorage: token + user JSON + redirectAfterLogin
    |  AuthContext (React Context)
    v
[BE - Express :4000]
    |  JWT middleware (requireAuth / requireAdmin / optionalAuth)
    |  7 Router modules (auth, rooms, bookings, users, reviews, chatbot, stats)
    v
[MySQL :3306 — smart_hotel DB]
    25 tables, triggers, indexes
```

**Mô hình phòng 2 tầng (điểm đặc biệt):**
```
room_types (loại phòng — template)
    └── rooms (phòng vật lý — instance)
            └── room_inventory (lịch trống/bận theo từng ngày)
```

---

## 3. FOLDER STRUCTURE

```
demo_khoaluan/
├── BE/                         Backend Node/Express/TypeScript
│   ├── src/
│   │   ├── index.ts            Entry point — khởi tạo Express, mount routers
│   │   ├── db/
│   │   │   ├── client.ts       MySQL connection pool (mysql2/promise)
│   │   │   ├── schema.ts       Script tạo bảng (npm run db:init)
│   │   │   ├── seed.ts         Dữ liệu mẫu (npm run db:seed)
│   │   │   ├── fix-images.ts   Script sửa ảnh base64 bị split
│   │   │   ├── test-connection.ts  Kiểm tra kết nối DB
│   │   │   ├── migrate_vnpay.ts    VNPay Schema Migration script
│   │   │   ├── migrate_unique_order.ts  Migration unique order_id
│   │   │   └── vnpay_setup.sql     SQL setup for payments
│   │   ├── middleware/
│   │   │   ├── auth.ts         requireAuth / requireAdmin / optionalAuth
│   │   │   └── error.ts        Global error handler
│   │   ├── routes/
│   │   │   ├── auth.ts         POST /login, POST /register, GET /me
│   │   │   ├── rooms.ts        CRUD room types + physical rooms + inventory + pricing
│   │   │   ├── bookings.ts     Tạo/thanh toán/hủy booking + auto-release + VNPay
│   │   │   ├── users.ts        CRUD users + đổi mật khẩu
│   │   │   ├── reviews.ts      CRUD reviews + admin moderation
│   │   │   ├── chatbot.ts      AI Chatbot Agent (Ollama Direct)
│   │   │   ├── hotel.ts        Hotel Info API
│   │   │   └── stats.ts        Dashboard statistics
│   │   └── services/
│   │       ├── chatbot/
│   │       │   ├── agent.ts    Dual-Model Brain (1b NLU + 3b Synthesis)
│   │       │   ├── prompt.js   System Prompts & Guardrails
│   │       │   └── tools.ts    SQL Tools (3-tier pricing, inventory fallback)
│   │       └── vnpay.ts        VNPay Gateway Service
│   ├── migrations/             SQL migration scripts
│   │   └── payment_schema_v2_safe.sql  Safe migration: payment model + audit log
│   ├── .env                    PORT, DB_*, JWT_SECRET, GROQ_API_KEY, VNP_*
│   ├── package.json            scripts: dev/build/start/db:init/db:seed
│   ├── schema_dump.sql         Dump live schema (cấu trúc only, không data)
│   ├── check-db.mjs            Script kiểm tra DB
│   ├── migrate-beds.mjs        Migration beds
│   ├── migrate-expires.mjs     Migration expires_at
│   ├── migrate-review-reply.mjs Migration review reply
│   └── tsconfig.json
│
├── FE/                         Frontend React/Vite/TypeScript
│   ├── src/
│   │   ├── main.tsx            React DOM render root
│   │   ├── App.tsx             Router + Providers (Auth, Toast)
│   │   ├── index.css           Tailwind base styles
│   │   ├── lib/
│   │   │   ├── api.ts          Tất cả API calls (fetch wrapper + interfaces)
│   │   │   ├── auth.tsx        AuthContext + AuthProvider + useAuth hook
│   │   │   ├── constants.ts    COUNTRIES, FALLBACK_IMG
│   │   │   ├── redirectToLogin.ts  Helper redirect sang /login + lưu localStorage
│   │   │   └── utils.ts        formatVND, formatDate, date helpers
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── ProfileSidebar.tsx
│   │   │   │   └── ScrollToTop.tsx
│   │   │   ├── features/
│   │   │   │   ├── RoomCard.tsx
│   │   │   │   ├── BookingCard.tsx
│   │   │   │   ├── ChatWidget.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   └── StatCard.tsx
│   │   │   ├── admin/
│   │   │   │   └── DateRangeFilter.tsx
│   │   │   └── ui/
│   │   │       ├── Badge.tsx
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Toast.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx                Trang chủ + recommendations
│   │   │   ├── RoomList.tsx            Danh sách phòng vật lý + filter
│   │   │   ├── RoomDetail.tsx          Chi tiết loại phòng
│   │   │   ├── PhysicalRoomDetail.tsx  Chi tiết phòng vật lý (Airbnb-style, 3-tier pricing)
│   │   │   ├── Checkout.tsx            Thanh toán đặt phòng (3 steps, VNPay/Cash, early/late fee)
│   │   │   ├── BookingHistory.tsx      Lịch sử đặt phòng (auto-reload khi state.refresh=true)
│   │   │   ├── Profile.tsx             Trang cá nhân
│   │   │   ├── Login.tsx               Đăng nhập (redirect-after-login + localStorage fallback)
│   │   │   ├── Register.tsx            Đăng ký
│   │   │   ├── VNPayReturn.tsx         Return URL từ VNPay (verify + hiển thị kết quả)
│   │   │   ├── About.tsx               Giới thiệu team (Group 92) & supervisor
│   │   │   ├── Services.tsx            Danh sách tiện ích & chính sách
│   │   │   ├── Contact.tsx             Liên hệ & Feedback form (hotel_info sync)
│   │   │   ├── AdminDashboard.tsx      (legacy redirect)
│   │   │   └── admin/
│   │   │       ├── AdminLayout.tsx
│   │   │       ├── Dashboard.tsx
│   │   │       ├── AdminInvoices.tsx   Quản lý hóa đơn & Receipt modal
│   │   │       ├── AdminRooms.tsx
│   │   │       ├── AdminRoomTypes.tsx
│   │   │       ├── AdminRoomUnit.tsx   Pricing tab 3-tier
│   │   │       ├── AdminRoomUnits.tsx  Realtime polling (30s), booking time UI
│   │   │       ├── AdminBookings.tsx
│   │   │       ├── AdminUsers.tsx
│   │   │       ├── AdminReviews.tsx
│   │   │       └── AdminSettings.tsx
│   │   └── types/
│   │       └── index.ts
│   ├── .env                    VITE_API_URL=http://localhost:4000/api
│   ├── vite.config.ts
│   ├── metadata.json           Metadata file
│   └── package.json
│
├── PROJECT_WIKI.md             (file này)
├── CHATBOT_DOCUMENTATION.md    Tài liệu AI Chatbot
├── README.md                   Hướng dẫn setup project
└── schema_dump.sql             MySQL dump toàn bộ schema (root — legacy, xem BE/schema_dump.sql)
```

---

## 4. DATABASE SCHEMA (25 bảng)

### Nhóm Phòng
| Bảng | Mô tả |
|---|---|
| `hotel_info` | Thông tin khách sạn (tên, địa chỉ, SĐT, email, mô tả) |
| `room_categories` | Phân loại phòng (Standard, Deluxe, Suite...) |
| `room_types` | Template loại phòng: tên, giá base, sức chứa, diện tích, category |
| `amenities` | Danh sách tiện nghi |
| `room_type_amenities` | Quan hệ N-N: loại phòng ↔ tiện nghi |
| `bed_types` | Loại giường (Single, Double, King...) |
| `room_type_beds` | Loại giường + số lượng cho từng loại phòng |
| `rooms` | Phòng vật lý: số phòng, tầng, trạng thái (ACTIVE/INACTIVE/MAINTENANCE/CLEANING), room_note |
| `room_images` | Ảnh của từng phòng vật lý (MEDIUMTEXT url, hỗ trợ base64) |
| `room_inventory` | Lịch trống/bận theo ngày của từng phòng (AVAILABLE/PENDING/BOOKED/BLOCKED) |
| `room_prices` | Giá override theo ngày cho **phòng vật lý** (tier 1) |
| `room_type_prices` | Giá override theo ngày cho **loại phòng** (tier 2) |
| `pricing_rules` | Quy tắc phụ phí theo giờ check-in/check-out |

### Nhóm Người dùng
| Bảng | Mô tả |
|---|---|
| `users` | Tài khoản: username, password (bcrypt), full_name, email, phone |
| `roles` | Vai trò: USER, ADMIN |
| `user_roles` | Quan hệ N-N: user ↔ role |

### Nhóm Đặt phòng & Thanh toán
| Bảng | Mô tả |
|---|---|
| `bookings` | Đơn đặt phòng: status (PENDING/PARTIALLY_PAID/CONFIRMED/**CHECKED_IN**/COMPLETED/CANCELLED), expires_at, paid_amount, remaining_amount, payment_policy (FULL/DEPOSIT) |
| `booking_rooms` | Chi tiết phòng trong booking: check_in, check_out, check_in_time, check_out_time, giá |
| `booking_guests` | Thông tin khách trong booking |
| `payment_transactions` | Giao dịch thanh toán: method, gateway (vnpay/cash), type (FULL/DEPOSIT/REMAINING), status (PENDING/SUCCESS/FAILED), order_id, trans_id |
| `payment_logs` | Audit trail: log sự kiện thanh toán, booking_id, gateway, action, raw_data JSON, status |

### Nhóm Khác
| Bảng | Mô tả |
|---|---|
| `reviews` | Đánh giá: rating 1-5, comment, status (VISIBLE/HIDDEN), unique(user_id, booking_id) |
| `chatbot_sessions` | Phiên chat AI |
| `chatbot_messages` | Tin nhắn trong phiên chat |
| `activity_logs` | Log hành động: LOGIN, REGISTER, CREATE_BOOKING, PAY_BOOKING... |

### Cấu trúc các bảng quan trọng

**`bookings`**
```sql
CREATE TABLE bookings (
  booking_id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT,
  total_price      INT,
  paid_amount      INT DEFAULT 0,
  remaining_amount INT DEFAULT 0,
  status           ENUM('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','PARTIALLY_PAID') DEFAULT 'PENDING',
  payment_policy   ENUM('FULL','DEPOSIT') DEFAULT 'FULL',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at       DATETIME NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
```

**`payment_transactions`**
```sql
CREATE TABLE payment_transactions (
  payment_id       INT AUTO_INCREMENT PRIMARY KEY,
  booking_id       INT,
  amount           INT,
  method           VARCHAR(50),
  gateway          VARCHAR(50) DEFAULT 'CASH',
  type             ENUM('FULL', 'DEPOSIT', 'REMAINING') DEFAULT 'FULL',
  order_id         VARCHAR(100) NULL,
  trans_id         VARCHAR(100) NULL,
  status           ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_order (order_id, gateway),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);
```

**`payment_logs`**
```sql
CREATE TABLE payment_logs (
  log_id      INT AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT,
  gateway     VARCHAR(50),
  action      VARCHAR(100),
  raw_data    JSON,
  status      VARCHAR(50),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL
);
```

**`room_inventory`**
```sql
CREATE TABLE room_inventory (
  inventory_id INT AUTO_INCREMENT PRIMARY KEY,
  room_id      INT,
  date         DATE NOT NULL,
  is_available TINYINT(1) DEFAULT 1,
  price        INT,
  status       ENUM('AVAILABLE','PENDING','BOOKED','BLOCKED') DEFAULT 'AVAILABLE',
  booking_id   INT NULL,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE (room_id, date),
  KEY idx_room_date_status (room_id, date, status),
  KEY idx_booking_id (booking_id)
);
```

### Indexes quan trọng
- `room_inventory`: `(room_id, date, status)` — tối ưu query kiểm tra phòng trống
- `payment_transactions`: `UNIQUE(order_id, gateway)` — dedup VNPay transactions

> **Migration cần chạy:** `BE/migrations/add_checked_in_status.sql`
> ```sql
> ALTER TABLE bookings MODIFY COLUMN status
>   ENUM('PENDING','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','PARTIALLY_PAID')
>   COLLATE utf8mb4_unicode_ci NOT NULL;
> ```

---

## 5. API ENDPOINTS

Base URL: `http://localhost:4000/api`  
Auth: `Authorization: Bearer <JWT>`  
🔓 = Public · 🔑 = Cần đăng nhập · 👑 = Admin only

### /api/auth
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/auth/register` | 🔓 | Đăng ký tài khoản mới, trả về JWT |
| POST | `/auth/login` | 🔓 | Đăng nhập bằng username/email + password |
| GET | `/auth/me` | 🔑 | Lấy thông tin user hiện tại |

### /api/rooms
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/rooms` | 🔓 | Danh sách loại phòng (filter: min_price, max_price, capacity) |
| POST | `/rooms` | 👑 | Tạo loại phòng mới |
| GET | `/rooms/:type_id` | 🔓 | Chi tiết loại phòng |
| PUT | `/rooms/:type_id` | 👑 | Cập nhật loại phòng |
| DELETE | `/rooms/:type_id` | 👑 | Xóa loại phòng |
| GET | `/rooms/all-units` | 🔓 | Tất cả phòng vật lý (filter + date range); ảnh ONLY từng phòng |
| GET | `/rooms/available` | 🔓 | Phòng còn trống theo check_in/check_out |
| GET | `/rooms/recommendations` | 🔓 | Gợi ý phòng thông minh (AI scoring) |
| GET | `/rooms/categories/list` | 🔓 | Danh sách categories |
| GET | `/rooms/bed-types/list` | 🔓 | Danh sách loại giường |
| GET | `/rooms/pricing-rules` | 🔓 | Quy tắc phụ phí check-in/out |
| GET | `/rooms/physical/:room_id` | 🔓 | Chi tiết phòng vật lý; trả `images[]` ONLY của phòng đó |
| GET | `/rooms/physical/:room_id/availability` | 🔓 | Ngày không khả dụng (120 ngày, Recursive CTE) |
| GET | `/rooms/physical/:room_id/similar` | 🔓 | Phòng tương tự; ảnh ONLY của từng phòng |
| GET | `/rooms/admin/units-status` | 👑 | Trạng thái tất cả phòng theo ngày + booking info (polling) |
| GET | `/rooms/:type_id/units` | 👑 | Danh sách phòng vật lý theo loại |
| POST | `/rooms/:type_id/units` | 👑 | Thêm phòng vật lý |
| PATCH | `/rooms/units/:room_id` | 👑 | Cập nhật phòng vật lý |
| DELETE | `/rooms/units/:room_id` | 👑 | Xóa phòng vật lý |
| GET | `/rooms/units/:room_id/detail` | 👑 | Chi tiết đầy đủ phòng vật lý |
| GET | `/rooms/units/:room_id/price-range` | 🔓 | Giá theo date range (3-tier, Recursive CTE) |
| PUT | `/rooms/units/:room_id/price` | 👑 | Đặt giá override (batch by date range) |
| DELETE | `/rooms/units/:room_id/price` | 👑 | Xóa giá override (về base) |
| GET | `/rooms/units/:room_id/images` | 👑 | Danh sách ảnh phòng |
| POST | `/rooms/units/:room_id/images` | 👑 | Thêm ảnh |
| DELETE | `/rooms/images/:image_id` | 👑 | Xóa ảnh |
| GET | `/rooms/units/:room_id/bookings` | 👑 | Lịch sử booking của phòng |
| POST | `/rooms/units/:room_id/retype` | 👑 | Tạo/tái sử dụng loại phòng mới (Smart Logic) |
| GET | `/rooms/:type_id/amenities` | 👑 | Tiện nghi của loại phòng |
| POST | `/rooms/:type_id/amenities` | 👑 | Thêm tiện nghi |
| DELETE | `/rooms/:type_id/amenities/:id` | 👑 | Xóa tiện nghi |
| GET | `/rooms/:type_id/beds` | 👑 | Giường của loại phòng |
| POST | `/rooms/:type_id/beds` | 👑 | Thêm giường |
| DELETE | `/rooms/:type_id/beds/:id` | 👑 | Xóa giường |

#### Response mẫu — `/rooms/admin/units-status`
```json
{
  "room_id": 5,
  "room_number": "101",
  "display_status": "BOOKED",
  "booking": {
    "booking_id": 42,
    "check_in": "2026-04-18",
    "check_out": "2026-04-20",
    "check_in_time": "14:00",
    "check_out_time": "11:00"
  }
}
```

#### Response mẫu — `/rooms/units/:id/price-range`
```json
{
  "data": [
    { "date": "2026-04-18", "base_price": 800000, "type_price": null, "room_price": 700000, "final_price": 700000 },
    { "date": "2026-04-19", "base_price": 800000, "type_price": 850000, "room_price": null, "final_price": 850000 }
  ],
  "subtotal": 1550000
}
```

### /api/bookings
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/bookings` | 🔑 | User: booking của mình · Admin: tất cả (filter date) |
| POST | `/bookings` | 🔑 | Tạo booking mới (transaction-safe, lock inventory, expires_at = NOW+10m) |
| GET | `/bookings/:id` | 🔑 | Chi tiết booking (rooms + guests + payments + paid_amount + remaining_amount) |
| GET | `/bookings/:id/status` | 🔑 | Polling nhẹ — chỉ trả `{ booking_id, status }` |
| PATCH | `/bookings/:id/pay` | 🔑 | Thanh toán tiền mặt — cho phép status PENDING hoặc CHECKED_IN |
| POST | `/bookings/:id/vnpay` | 🔑 | Khởi tạo URL thanh toán VNPay — cho phép PENDING, PARTIALLY_PAID, CHECKED_IN |
| GET | `/bookings/vnpay-return` | 🔓 | Return URL — verify chữ ký + đọc status DB |
| GET | `/bookings/vnpay-ipn` | 🔓 | Webhook IPN từ VNPay — Auto-confirm booking |
| PATCH | `/bookings/:id/check-in` | 🔑 | Check-in trực tuyến (user: chỉ đúng ngày UTC+7; admin: bất kỳ ngày) |
| PATCH | `/bookings/:id/check-out` | 👑 | Admin check-out, tính phí trả muộn theo giờ thực tế |
| GET | `/bookings/daily-plan` | 👑 | Danh sách check-in/check-out hôm nay |
| PATCH | `/bookings/:id/status` | 👑 | Admin đổi trạng thái |
| DELETE | `/bookings/:id` | 🔑 | User hủy booking (khôi phục inventory) |
| DELETE | `/bookings/:id/hard` | 👑 | Admin xóa cứng |

### /api/reviews
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/reviews?type_id=` | 🔓 | Đánh giá VISIBLE theo loại phòng |
| GET | `/reviews/my` | 🔑 | Đánh giá của user hiện tại |
| POST | `/reviews` | 🔑 | Tạo đánh giá (chỉ booking COMPLETED) |
| PATCH | `/reviews/:id` | 🔑 | Sửa đánh giá của mình |
| GET | `/reviews/admin` | 👑 | Tất cả đánh giá + filter |
| PATCH | `/reviews/:id/visibility` | 👑 | Ẩn/hiện đánh giá |
| DELETE | `/reviews/:id` | 👑 | Xóa đánh giá |

### /api/users
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/users` | 👑 | Danh sách users (filter date) |
| GET | `/users/:id` | 🔑 | Chi tiết user |
| PATCH | `/users/:id` | 🔑 | Cập nhật full_name, phone |
| PATCH | `/users/:id/password` | 🔑 | Đổi mật khẩu |
| GET | `/users/:id/bookings` | 🔑 | Lịch sử booking của user |
| DELETE | `/users/:id` | 👑 | Xóa user (soft delete nếu có booking) |

### /api/stats · /api/chatbot · /api/health
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/stats` | 👑 | Doanh thu, booking, phòng trống, users |
| GET | `/stats/analytics` | 👑 | Thống kê sâu (Recharts) |
| GET | `/stats/invoices` | 👑 | Danh sách hóa đơn & doanh thu thực tế |
| POST | `/chatbot/message` | 🔓 | Gửi tin nhắn, Agent xử lý Intent + RAG + Tools |
| GET | `/health` | 🔓 | Health check server |
| GET | `/hotel/info` | 🔓 | Lấy thông tin khách sạn thực tế |

---

## 6. FRONTEND COMPONENTS & PAGES

### Routes (App.tsx)
| Path | Component | Mô tả |
|---|---|---|
| `/` | Home | Trang chủ, recommendations |
| `/rooms` | RoomList | Danh sách phòng vật lý + filter |
| `/rooms/:id` | RoomDetail | Chi tiết loại phòng |
| `/room/:room_id` | PhysicalRoomDetail | Chi tiết phòng vật lý cụ thể |
| `/checkout` | Checkout | Thanh toán (nhận state từ navigate; hỗ trợ `existingBookingResult` để thanh toán lại) |
| `/profile` | Profile | Trang cá nhân user |
| `/history` | BookingHistory | Lịch sử đặt phòng; tự reload khi `state.refresh=true` |
| `/payment/vnpay-return` | VNPayReturn | Nhận redirect từ VNPay; gọi API verify + hiển thị kết quả |
| `/login` | Login | Đăng nhập + redirect-after-login |
| `/register` | Register | Đăng ký |
| `/admin` | AdminLayout | Layout admin (Outlet) — được bảo vệ bởi `<ProtectedRoute requireAdmin={true}>` |
| `/admin/` | Dashboard | Thống kê tổng quan |
| `/admin/rooms` | AdminRooms | Quản lý loại phòng |
| `/admin/rooms/:typeId` | AdminRoomTypes | Chi tiết loại phòng + units |
| `/admin/rooms/:typeId/units/:roomId` | AdminRoomUnit | Chi tiết 1 phòng vật lý |
| `/admin/room-units` | AdminRoomUnits | Tất cả phòng vật lý — sơ đồ realtime |
| `/admin/users` | AdminUsers | Quản lý users |
| `/admin/bookings` | AdminBookings | Quản lý bookings |
| `/admin/invoices` | AdminInvoices | Quản lý hóa đơn |
| `/admin/reviews` | AdminReviews | Kiểm duyệt reviews |
| `/admin/settings` | AdminSettings | Cài đặt khách sạn |
| `/about` | About | Giới thiệu đội ngũ phát triển (Group 92) |
| `/services` | Services | Tiện ích & chính sách khách sạn |
| `/contact` | Contact | Thông tin liên hệ & bản đồ |

### Lib / Utilities

#### `FE/src/lib/redirectToLogin.ts`
Helper dùng chung cho mọi trang cần redirect về login:
```typescript
export function redirectToLogin(navigate, location, extra?) {
  const from = location.pathname + location.search;
  localStorage.setItem('redirectAfterLogin', from);
  navigate('/login', { replace: false, state: { from, ...extra } });
}
```

#### `FE/src/lib/api.ts` — types cập nhật

**API Xác thực (Authentication):**
```typescript
export const authApi = {
  login: ...,
  register: ...,
  me: () => get<AuthUser>('/auth/me'), // Verify token với server
};
```

**`RoomDisplayUnit`** — thêm field `booking`:
```typescript
booking: {
  booking_id: number | null;
  check_in: string | null;    // YYYY-MM-DD
  check_out: string | null;   // YYYY-MM-DD
  check_in_time: string;      // HH:mm
  check_out_time: string;     // HH:mm
} | null;
```

**`PriceRangeDay` / `PriceRangeResponse`** — interface 3-tier pricing:
```typescript
interface PriceRangeDay {
  date: string;
  base_price: number;
  type_price: number | null;
  room_price: number | null;
  final_price: number;  // = COALESCE(room_price, type_price, base_price)
}
interface PriceRangeResponse { data: PriceRangeDay[]; subtotal: number; }
```

---

## 7. BUSINESS LOGIC — ĐIỂM KHÁC BIỆT

### 7.1 Mô hình phòng 2 tầng
- `room_types`: định nghĩa tên, giá base, tiện nghi, giường — dùng chung
- `rooms`: phòng thực tế có số phòng, tầng, trạng thái riêng
- Một loại phòng có thể có nhiều phòng vật lý (VD: "Deluxe" có phòng 101, 201, 301)

### 7.2 Hệ thống giá 3 tầng (Price Priority)
```
Giá hiệu lực = room_prices       (override ngày cụ thể — phòng vật lý)  Tier 1
             ?? room_type_prices  (override ngày cụ thể — loại phòng)    Tier 2
             ?? room_types.base_price  (giá gốc loại phòng)              Tier 3

SQL dùng Recursive CTE:
WITH date_range AS (
  SELECT DATE(?) AS d
  UNION ALL
  SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM date_range
  WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(?)
)
SELECT d AS date,
       rt.base_price,
       rtp.price AS type_price,
       rp.price  AS room_price,
       COALESCE(rp.price, rtp.price, rt.base_price) AS final_price
FROM date_range dr
LEFT JOIN room_prices rp       ON rp.room_id  = ? AND rp.date  = dr.d
LEFT JOIN room_type_prices rtp ON rtp.type_id = ? AND rtp.date = dr.d
JOIN room_types rt ON rt.type_id = ?
```

### 7.3 Phụ phí theo giờ (pricing_rules)
```
Check-in sớm:
  05:00–09:00 → +50% giá 1 đêm
  09:00–14:00 → +30% giá 1 đêm

Check-out muộn (default 11:00):
  11:00–15:00 → +30% giá 1 đêm
  15:00–18:00 → +50% giá 1 đêm
  18:00+      → +100% giá 1 đêm
```

### 7.4 Booking Transaction-Safe & Inventory Sync
1. `SELECT ... FOR UPDATE` lock các row inventory → tránh double booking.
2. Fallback kiểm tra conflict qua `booking_rooms` nếu không có inventory.
3. **Inventory Sync**: Hàm `updateInventoryStatusForBooking` sử dụng `INSERT ... ON DUPLICATE KEY UPDATE` để tự động đồng bộ trạng thái phòng trong bảng `room_inventory` dựa trên dữ liệu thực tế từ `booking_rooms`. Điều này đảm bảo lịch luôn đồng bộ ngay cả khi inventory chưa được khởi tạo trước.
4. Booking tạo ra với `status=PENDING` và `expires_at = NOW + 10 phút`.
5. Sau thanh toán → `status=CONFIRMED`, xóa `expires_at`.

### 7.5 Auto-Release Expired Bookings
Job mỗi 60 giây: tìm PENDING quá `expires_at` → restore inventory → CANCELLED

### 7.5b Check-in Flow (Online Self Check-in)
```
PATCH /api/bookings/:id/check-in
  Điều kiện:
    - booking.status === 'CONFIRMED'
    - User: today (UTC+7) === check_in date (UTC+7)  ← fix timezone MySQL Date object
    - Admin: bỏ qua kiểm tra ngày

  Khi thành công:
    - rooms.status → 'CLEANING'   (phòng đang chuẩn bị)
    - bookings.status → 'CHECKED_IN'
    - Ghi activity_log: CHECK_IN:{id}

  FE (BookingCard):
    - isToday dùng UTC+7 (Date.now() + 7h) để khớp BE
    - Nút "Check-in trực tuyến" chỉ active khi isToday === true
    - Sau check-in → navigate('/checkin-ticket/:id')
```

### 7.5c Thanh toán Tiền Còn Lại (PayRemainingModal)
Khi booking có `remaining_amount > 0` và status là `PENDING`, `PARTIALLY_PAID`, hoặc `CHECKED_IN`:

**FE — BookingCard hiển thị:**
- "Tổng tiền" — `total_price`
- "Đã thanh toán" (xanh lá) — `paid_amount` (chỉ hiện khi đã trả một phần)
- "Còn cần thanh toán" (đỏ) — `remaining_amount`
- Nút "Thanh toán" → mở `PayRemainingModal`

**PayRemainingModal:**
- Tóm tắt: Tổng / Đã trả / Còn lại
- Chọn phương thức: VNPay (redirect) hoặc Tiền mặt (xác nhận tại quầy)
- VNPay: `POST /bookings/:id/vnpay` → `window.location.href = paymentUrl`
- Cash: `PATCH /bookings/:id/pay` → refresh danh sách

**BE — Logic thanh toán khi CHECKED_IN:**
- `PATCH /:id/pay`: cho phép PENDING hoặc CHECKED_IN; giữ nguyên status CHECKED_IN sau khi trả
- `POST /:id/vnpay`: cho phép PENDING, PARTIALLY_PAID, CHECKED_IN; `finalAmount = remaining_amount`; `paymentType = 'REMAINING'`

### 7.6 Smart Room Recommendation (AI Scoring)
```
score = 0.4 × type_match + 0.2 × rating + 0.2 × price_proximity
      + 0.1 × amenity_match + 0.1 × popularity
```
User chưa có lịch sử → sort theo rating + popularity.

### 7.7 Smart Retype Room (retypeRoom)
Admin đổi loại phòng → hệ thống tìm room_type khớp hoàn toàn để tái sử dụng (tránh duplicate).

### 7.8 Soft Delete User
User có booking → anonymize: `deleted_{id}@removed.local`, `[Đã xóa]`, xóa role.

### 7.9 Công thức tính giá booking
```
subtotal     = SUM(final_price_per_day)  ← từ API price-range
early_fee    = calcEarlyFee(check_in_time, base_per_night)
late_fee     = calcLateFee(check_out_time, base_per_night)
total_price  = (subtotal + early_fee + late_fee) × 1.15  (+15% VAT+service)
```
**Frontend KHÔNG tự tính subtotal — dùng giá trị từ API.**

### 7.10 Review Constraints
- Chỉ đánh giá booking `COMPLETED` · 1 lần / 1 booking
- Gắn với `room_type_id` (không phải phòng vật lý)
- Admin ẩn/hiện (VISIBLE/HIDDEN), public chỉ thấy VISIBLE

### 7.11 Redirect-After-Login
Khi user chưa login bấm action cần auth:
1. `redirectToLogin()` lưu `from` vào **state** + **localStorage**
2. Sau login: đọc `from = state.from || localStorage.get('redirectAfterLogin') || '/'`
3. `navigate(from, { replace: true })`, xóa localStorage
4. Admin luôn về `/admin` bất kể `from`

> **Lý do cần localStorage:** React Router state mất khi refresh trang `/login`.

### 7.12 Image Policy — Strict Per-Room
**Rule:** Mỗi phòng vật lý CHỈ hiển thị ảnh trong `room_images` của chính nó:

| Endpoint | SQL ảnh |
|---|---|
| `/all-units` | Correlated subquery `LIMIT 1` theo `room_id` |
| `/physical/:id` | `GROUP_CONCAT(url ORDER BY image_id SEPARATOR '|||')` của phòng |
| `/physical/:id/similar` | Correlated subquery `LIMIT 1` cho từng phòng |

**FE Fallback:** `FALLBACK_IMG` (Unsplash) khi `image=null` + `onError` handler khi URL hỏng.

### 7.13 AdminRoomUnits Realtime Polling
- Polling `GET /rooms/admin/units-status` mỗi **30 giây** (no Socket.io needed)
- Khi nhận data mới: so sánh `display_status` để detect phòng thay đổi
- **Chip animation:** highlight ring vàng 3 giây khi phòng vừa đổi trạng thái
- **"Sắp trả"** badge đỏ + `animate-pulse` khi checkout còn < 60 phút
- **Indicator:** `● Realtime · HH:mm:ss` (xanh) / `Mất kết nối` (đỏ) khi fetch fail

### 7.14 Tối ưu hóa hiệu năng (Performance Tuning)
Để đảm bảo trải nghiệm "Airbnb-style" mượt mà:
- **Memoization**: Toàn bộ các sub-component nặng như `AvailabilityCalendar`, `SimilarCarousel`, `Lightbox` được bọc trong `React.memo`. Các tính toán phức tạp về ngày tháng được bọc trong `useMemo`.
- **API Debouncing**: Các yêu cầu API lấy giá (`fetchPriceRange`) và phòng tương tự (`fetchSimilar`) được thực hiện qua cơ chế debounce để tránh gửi hàng chục request khi người dùng tương tác nhanh với lịch.
- **SQL Optimization**: Sử dụng Recursive CTE để tạo dải 120 ngày liên tục, kết hợp `LEFT JOIN` và `MAX()` để giải quyết triệt để lỗi `only_full_group_by` trong MySQL strict mode.

---

## 8. FLOW QUAN TRỌNG

### Flow 1: Đăng nhập + Redirect
```
User chưa login → bấm "Đặt phòng"
  → redirectToLogin(navigate, location)
     → localStorage.setItem('redirectAfterLogin', '/room/107')
     → navigate('/login', { state: { from: '/room/107' } })
  → Login thành công:
     → from = state.from || localStorage.redirectAfterLogin || '/'
     → localStorage.removeItem('redirectAfterLogin')
     → navigate(from, { replace: true })   → /room/107
```

### Flow 1.1: Bảo vệ Route Admin (ProtectedRoute)
```
User truy cập /admin
  1. Kiểm tra localStorage có token không?
     → Không có: redirectToLogin(..., { from: '/admin' })
  2. Có token → Gọi `authApi.me()`
     → Server trả 401 (token hết hạn): logout() → redirectToLogin()
     → Server trả 200: Kiểm tra role
        → role !== 'ADMIN': Toast cảnh báo + navigate('/')
        → role === 'ADMIN': Render <AdminLayout />
```

### Flow 2: Tìm kiếm & Đặt phòng
```
1. /rooms → GET /rooms/all-units → cards (ảnh riêng từng phòng)
2. /room/:id → GET /rooms/physical/:id → images[], beds[], amenities[]
3. Chọn ngày → GET /rooms/units/:id/price-range → bảng giá 3-tier
4. Nếu chưa login → redirectToLogin() → login → về /room/:id
5. "Đặt phòng ngay" → navigate('/checkout', { state })
6. Checkout → POST /bookings → PENDING (10 phút)
7. Xác nhận → PATCH /bookings/:id/pay → CONFIRMED
8. → /history
```

### Flow 3: Auto-Release Booking Hết Hạn
```
setInterval(60s):
  SELECT booking PENDING + expires_at < NOW()
  → UPDATE room_inventory SET status='AVAILABLE'
  → UPDATE booking SET status='CANCELLED'
```

### Flow 7: Thanh toán VNPay Sandbox (Nâng cao)
```
┌─────────────────────────────────────────────────────────────────────┐
│                     VNPAY PAYMENT FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

[1] USER chọn VNPay trên Checkout (Thanh toán cọc / Thanh toán phần còn lại)
    FE → POST /api/bookings/:id/vnpay
         { booking_id, total_price }

[2] BE — VNPay SDK (lehuygiang28/vnpay v2.5.0)
    ├── Tạo mã giao dịch độc nhất (vnp_TxnRef): `txnRef = ${booking_id}_${Date.now()}`
    │   (Tránh lỗi trùng mã giao dịch khi khách hàng thanh toán nhiều đợt)
    ├── Upsert bảng `payment_transactions` với status='PENDING' và `order_id`=txnRef
    └── vnpay.buildPaymentUrl() sinh ra URL có chứa HMAC-SHA512 checksum

[3] FE nhận paymentUrl → window.location.href = paymentUrl
    → Browser redirect sang https://sandbox.vnpayment.vn

[4] User thanh toán trên VNPay Portal
    (nhập thẻ ATM / QR / thẻ quốc tế)

[5a] VNPay → IPN (server-to-server) GET /api/bookings/vnpay-ipn
     ├── verifyIpnCall(query) — HMAC-SHA512 verify
     ├── Tách `booking_id` từ `vnp_TxnRef` (txnRef.split('_')[0])
     ├── Check amount khớp với record `payment_transactions`
     ├── Cập nhật payment_transactions (order_id=vnp_TxnRef) thành SUCCESS/FAILED
     ├── Cộng dồn `paid_amount`, trừ `remaining_amount` trong bảng `bookings`
     ├── Nếu remaining_amount == 0 → status='CONFIRMED', nếu > 0 → 'PARTIALLY_PAID'
     ├── INSERT payment_logs (audit trail)
     └── Response { RspCode: '00', Message: 'Success' }

[5b] VNPay → Redirect browser về VNP_RETURN_URL
     = http://localhost:3000/payment/vnpay-return?vnp_*=...

[6] FE VNPayReturn.tsx
     ├── Gọi bookingApi.vnpayReturn(queryString)
     │   → GET /api/bookings/vnpay-return?{all vnp params}
     ├── BE verify chữ ký + thực hiện đồng bộ DB idempotent (như IPN)
     ├── Hiển thị kết quả (success / failed)
     └── Nút "Xem lịch sử" → navigate('/history', { state: { refresh: true } })

[7] BookingHistory.tsx
     ├── Detect state.refresh → gọi load() sau 500ms
     └── Hiển thị booking với status và paid_amount mới
```

### Flow 4: Admin Quản lý Phòng — Dashboard Realtime
```
/admin/room-units
  → Polling 30s: GET /rooms/admin/units-status?date=YYYY-MM-DD
  → Chip theo tầng:
      [101] 🟢 Phòng trống
      [102] 🔒 Đang có khách  ←→  14:00 · 11:00 (check-in/out)
      [202] 🧹 Đang dọn         [Sắp trả] (animation đỏ nếu < 1h)
  → Click chip → popover:
      · Booking: nhận HH:mm · trả HH:mm · còn Xh Ym
      · Edit: số phòng, tầng, trạng thái, ghi chú
      · Price: sửa/reset giá ngày
  → Phòng mới đổi trạng thái → highlight vàng 3s
  → Nút refresh thủ công + timestamp sync cuối
```

### Flow 5: Đánh giá
```
/history → booking COMPLETED → "Đánh giá"
  → POST /reviews { booking_id, rating, comment }
  → BE: booking của user + COMPLETED + chưa review
  → Lưu với room_type_id
```

### 7.15 AI Chatbot (Pipeline Hybrid: LangChain + Ollama)
- **Kiến trúc**: Sử dụng **LangChain** và **LangGraph** để xây dựng Agent theo mô hình ReAct (Reasoning + Acting). Chạy local hoàn toàn với Ollama (`llama3.2:3b`).
- **Luồng xử lý (Hybrid Pipeline tối ưu hiệu năng)**:
  1. **Quick Intent (Regex-first)**: Dùng Regex nhận diện cực nhanh các ý định phổ biến (`ask_availability`, `ask_price`, `ask_booking`, `general_info`). Nếu Regex thất bại, fallback sang LLM với `INTENT_PROMPT` để phân loại.
  2. **NLU + Context Memory**: `nlu.js` parse tiếng Việt thành `people`, `checkin/checkout`, `room_type`, `min_price/max_price`, `amenities`, `floor`, `sort_by`. `context.js` merge theo `sessionId`, hỗ trợ các câu nối tiếp như "loại khác giá 500", "giá cao hơn nữa".
  3. **Bypass LLM (Direct Tool Execution)**: Đối với `ask_availability`, `ask_price` và `alternative`, hệ thống gọi trực tiếp SQL tool `search_rooms` với đủ tiêu chí thay vì chỉ `people/max_price`.
  4. **Amenity Routing**: Các câu hỏi tiện ích được xử lý bằng DB trước FAQ: tiện ích khách sạn (`getHotelAmenitiesInfo`), tiện ích trong phòng (`getRoomAmenitiesInfo`), và tìm phòng theo tiện ích (`searchRoomsByAmenity`) như "phòng có bồn tắm nằm".
  5. **RAG Knowledge Base**: Đối với chính sách/FAQ, hệ thống bỏ qua LLM và truy xuất trực tiếp từ `knowledge.js`.
  6. **ReAct Agent Fallback**: Với `ask_booking` hoặc câu hỏi khác (`other`), hệ thống khởi tạo `createReactAgent` để Agent tự động suy luận và sử dụng các tools (vd: `get_booking`).
- **Xử lý Output**: Dùng hàm `safeParseJSON` để bóc tách an toàn các khối JSON từ phản hồi của LLM, giúp Frontend luôn nhận đúng định dạng `{ message, rooms: [] }` để render giao diện danh sách phòng.
- **Tài liệu chi tiết**: Xem `CHATBOT_DOCUMENTATION.md` để biết đầy đủ luồng NLU, session/context, tìm phòng theo tiện ích, hỏi tiện ích khách sạn/phòng và các ví dụ hội thoại.

### 7.16 Hệ thống thanh toán linh hoạt (Partial Payment)
- **Chính sách**: Cho phép khách hàng chọn thanh toán **30%, 50% hoặc 100%** giá trị đơn hàng lúc đặt phòng.
- **Trạng thái Booking**:
  - Thanh toán đủ: `status='CONFIRMED'`.
  - Thanh toán một phần: `status='PARTIALLY_PAID'`, `remaining_amount > 0`.
- **Logic thanh toán lại**: User có thể vào Lịch sử đặt phòng để tiếp tục thanh toán số tiền còn lại qua VNPay hoặc tiền mặt.
- **IPN Safe**: Hệ thống IPN tự động cộng dồn `paid_amount` và trừ dần `remaining_amount`, đảm bảo tính chính xác khi thanh toán nhiều lần.

### 7.17 Tổng hợp tài chính (Financial Summary)
- **Frontend**: Trang `BookingHistory` hiển thị một thẻ tổng kết "Tổng tiền cần thanh toán" cho tất cả các đơn hàng chưa hoàn tất (trừ đơn đã hủy).
- **Mục đích**: Giúp người dùng có cái nhìn tổng quan về các khoản nợ cần thanh toán để giữ chỗ hoặc hoàn tất thủ tục nhận phòng.

---

## 9. CONSTRAINTS & RULES

### Image Rules
- Ảnh lưu URL hoặc base64 trong `room_images.url` (MEDIUMTEXT)
- **Nghiêm cấm** fallback sang ảnh phòng cùng type — vi phạm tính chính xác dữ liệu
- Backend trả `image: null` nếu phòng không có ảnh
- FE dùng `FALLBACK_IMG` (Unsplash constant) + `onError` cho broken URL

### Pricing Rules
- Thứ tự ưu tiên: `room_prices` > `room_type_prices` > `base_price`
- API price-range dùng **Recursive CTE** — không tính loop tầng FE
- **FE KHÔNG tự calculate subtotal** — phải lấy từ `response.subtotal`
- Phụ phí check-in/out tính trên `base_price_per_night` (không phải tổng subtotal)
- Tổng = (subtotal + early_fee + late_fee) × 1.15

### Redirect Rules
- Không hardcode `/` sau login
- Priority: `state.from` → `localStorage.redirectAfterLogin` → `/`
- Admin luôn về `/admin`
- Dùng `{ replace: true }` để không back về `/login`

### Database Constraints
- `rooms.room_number` — UNIQUE
- `reviews.unique_review(user_id, booking_id)` — 1 user / 1 booking
- `room_inventory.UNIQUE(room_id, date)`
- `room_prices.UNIQUE(room_id, date)`
- `bookings.status ENUM` — PENDING/CONFIRMED/COMPLETED/CANCELLED
- `payment_transactions.UNIQUE(order_id, gateway)` — VNPay dedup
- `rooms.status ENUM` — ACTIVE/INACTIVE/MAINTENANCE/CLEANING

### Business Rules
- Booking chỉ tạo khi phòng `status=ACTIVE`
- PENDING tự hủy sau 10 phút
- Không hủy booking `COMPLETED`
- User có booking → soft delete (không xóa cứng)
- Review chỉ từ booking COMPLETED của chính user

### Auth Rules
- JWT hết hạn 7 ngày · lưu localStorage
- `requireAdmin` kiểm tra `userRole === 'ADMIN'` từ JWT payload
- `optionalAuth` không reject nếu không có token

---

## 10. ENVIRONMENT VARIABLES

### Backend (BE/.env)
```env
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=smart_hotel
JWT_SECRET=smarthotel_dev_secret
JWT_EXPIRES_IN=7d
GROQ_API_KEY=<your_groq_key>

# VNPay Sandbox
VNP_TMN_CODE=3YJMIUFG
VNP_HASH_SECRET=YJIE66WA8NYB04CNT3GP91LQMTCVSRLZ
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:3000/payment/vnpay-return
```

### Frontend (FE/.env)
```env
VITE_API_URL=http://localhost:4000/api
```

---

## 11. QUICK START

```bash
# 1. Khởi động MySQL
mysql -u root -p
CREATE DATABASE IF NOT EXISTS smart_hotel;

# 2. Backend
cd BE && npm install
npm run db:init    # tạo schema
npm run db:seed    # dữ liệu mẫu
npm run dev        # :4000

# 3. Frontend
cd FE && npm install
npm run dev        # :3000

# 4. Verify
curl http://localhost:4000/api/health
# → { "status": "ok" }
```

---

## 12. TÍNH NĂNG HIỆN TẠI

### Đã hoàn thiện
- [x] Đặt phòng vật lý (2-tier model)
- [x] Hệ thống giá 3 tầng (room_prices > room_type_prices > base_price)
- [x] Phụ phí check-in sớm / check-out muộn
- [x] Hệ thống thanh toán linh hoạt (Đặt cọc 30%, 50%, 100%)
- [x] Thanh toán VNPay Sandbox (Idempotent IPN, hỗ trợ thanh toán nhiều lần)
- [x] Thanh toán tiền mặt tại khách sạn
- [x] Auto-release booking hết hạn (60s job)
- [x] AI Chatbot (LangChain + LangGraph + Ollama llama3.2, Hybrid Intent)
- [x] Admin dashboard realtime polling (30s)
- [x] Quản lý phòng vật lý (CRUD, retype, pricing)
- [x] Đánh giá phòng (reviews, moderation)
- [x] Redirect-after-login
- [x] Soft delete user
- [x] Activity logs + Payment audit trail

### TODO / ROADMAP
- [ ] **Dashboard Analytics**: Biểu đồ doanh thu theo tháng/năm, tỷ lệ lấp đầy phòng
- [ ] **Email Notification**: Gửi mail xác nhận khi đặt phòng thành công
- [ ] **Voucher / Promo Code**: Hệ thống giảm giá theo mã khuyến mãi
- [ ] **Bộ lọc nâng cao**: Lọc phòng theo tiện nghi, đánh giá
- [ ] **Multi-language**: Hỗ trợ Tiếng Anh/Tiếng Việt
- [ ] **Real-time Chat**: Socket.io cho nhân viên hỗ trợ trực tiếp
- [ ] **Hoàn tiền (Refund Logic)**: Xử lý hoàn tiền tự động qua Gateway
- [ ] **Phân quyền nâng cao**: Vai trò Lễ tân, Kế toán

---

## 13. LOGIC TÍNH TIỀN (PRICING LOGIC)

Dự án sử dụng hệ thống giá **3 tầng (3-tier)** linh hoạt:

1. **Độ ưu tiên (Priority):**
   - **Tier 1 (Cao nhất):** Giá theo ngày của phòng vật lý (`room_prices`)
   - **Tier 2 (Trung bình):** Giá theo ngày của loại phòng (`room_type_prices`)
   - **Tier 3 (Mặc định):** Giá gốc của loại phòng (`room_types.base_price`)
   - Logic: `COALESCE(Tier 1, Tier 2, Tier 3)`

2. **Công thức tính Booking:**
   - `Phòng (Subtotal)` = Tổng giá `final_price` của từng ngày trong khoảng `[check_in, check_out)`
   - `Phí nhận sớm (Early Fee)` = Tính trên giá 1 đêm đầu tiên (05:00–09:00: +50%, 09:00–14:00: +30%)
   - `Phí trả muộn (Late Fee)` = Tính trên giá 1 đêm cuối cùng (12:00–15:00: +30%, 15:00–18:00: +50%, 18:00+: +100%)
   - `Thuế & Phí` = `(Subtotal + Early + Late) × 15%` (5% Service + 10% VAT)
   - **Tổng thanh toán** = `(Subtotal + Early + Late) × 1.15`
   - **Số tiền cần trả ngay** = `Tổng thanh toán × % đặt cọc (30/50/100)`

3. **Chính sách đặt cọc & Thanh toán:**
   - Khách hàng có thể chọn đặt cọc 30%, 50% hoặc thanh toán 100%.
   - Nếu thanh toán một phần, đơn hàng sẽ ở trạng thái `PARTIALLY_PAID`.
   - Số tiền còn lại (`remaining_amount`) phải được thanh toán trước khi check-out.

4. **Chính sách huỷ phòng:**
   - Trước 48h: Hoàn tiền 100%
   - Trong vòng 48h: Phạt phí 1 đêm

---

## 14. VNPAY INTEGRATION — CHI TIẾT KỸ THUẬT

### 14.1 Cấu hình (BE/.env)
```env
VNP_TMN_CODE=3YJMIUFG
VNP_HASH_SECRET=YJIE66WA8NYB04CNT3GP91LQMTCVSRLZ
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=http://localhost:3000/payment/vnpay-return
```

### 14.2 VNPayService (`BE/src/services/vnpay.ts`)

Sử dụng thư viện `vnpay` v2.5.0 (SDK chính thức).

**Nguyên tắc ký chữ ký (CRITICAL):**
```typescript
// SDK tự xử lý sort + HMAC-SHA512
// Chỉ cần truyền đúng params, SDK build URL + ký
// IPv6 fix: ::1 → 127.0.0.1 trước khi truyền vào SDK
```

**Các params bắt buộc:**
| Param | Giá trị | Ghi chú |
|---|---|---|
| `vnp_Amount` | `total_price` | SDK tự nhân 100 |
| `vnp_TxnRef` | `booking_id` | Unique per day |
| `vnp_OrderInfo` | `Thanh toan don hang {id}` | |
| `vnp_ReturnUrl` | Từ `.env` | |
| `vnp_IpAddr` | IPv4 của client | `::1` → `127.0.0.1` |

### 14.3 Routes liên quan payment

#### `POST /api/bookings/:id/vnpay` — Tạo URL thanh toán
```
Response: { success: true, paymentUrl: "https://sandbox.vnpayment.vn/..." }
Logic:
1. Kiểm tra booking tồn tại + thuộc user + status IN (PENDING, PARTIALLY_PAID)
2. Nếu PARTIALLY_PAID: amount = remaining_amount. Nếu PENDING: amount = upfrontAmount (từ policy).
3. Fix IPv6: ::1 → 127.0.0.1
4. VNPayService.createPaymentUrl({ bookingId, amount, ipAddr, expireAt })
5. Trả paymentUrl
```

#### `GET /api/bookings/vnpay-return` — Return URL (FE gọi sau redirect)
```
Response: { success, booking_id, status, message }
Logic:
1. verifyReturnUrl(query) — verify chữ ký
2. Đọc booking.status từ DB
3. Map status → PENDING/CONFIRMED/FAILED
4. KHÔNG update DB (IPN là nơi update)
```

#### `GET /api/bookings/vnpay-ipn` — Webhook server-to-server
```
Response: { RspCode: '00', Message: 'Success' }
Logic:
1. verifyReturnUrl(query) — verify chữ ký
2. SELECT ... FOR UPDATE (lock row)
3. Kiểm tra số tiền khớp với số tiền đã yêu cầu thanh toán
4. Upsert payment_transactions (ON DUPLICATE KEY UPDATE)
5. Nếu SUCCESS:
   - `paid_amount = paid_amount + amount`
   - `remaining_amount = total_price - paid_amount`
   - `status = (remaining_amount == 0 ? 'CONFIRMED' : 'PARTIALLY_PAID')`
   - Xóa `expires_at`
   - Đồng bộ `room_inventory` sang `BOOKED`
6. INSERT payment_logs (audit)
```

### 14.4 Lỗi thường gặp & Fix

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| "Sai chữ ký" | encode sai | SDK tự xử lý, không tự build URL |
| IPN không nhận | localhost không public | Dùng ngrok hoặc deploy lên server |
| IPv6 reject | `::1` không hợp lệ | Fix `::1` → `127.0.0.1` trước khi truyền vào SDK |

### 14.5 Test Cards (Sandbox)
```
Ngân hàng: NCB
Số thẻ:    9704198526191432198
Tên:       NGUYEN VAN A
Ngày hết:  07/15
OTP:       123456
```

---

*Cập nhật lần cuối: 2026-04-22*
