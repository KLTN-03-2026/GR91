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
| AI Chatbot | Google Gemini API (@google/genai) |
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
    |  localStorage: token + user JSON
    |  AuthContext (React Context)
    v
[BE - Express :4000]
    |  JWT middleware (requireAuth / requireAdmin / optionalAuth)
    |  7 Router modules
    v
[MySQL :3306 — smart_hotel DB]
    24 tables, triggers, indexes
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
│   │   │   ├── schema.ts       Script tạo 24 bảng (npm run db:init)
│   │   │   ├── seed.ts         Dữ liệu mẫu (npm run db:seed)
│   │   │   ├── fix-images.ts   Script sửa ảnh base64 bị split
│   │   │   └── test-connection.ts  Kiểm tra kết nối DB
│   │   ├── middleware/
│   │   │   ├── auth.ts         requireAuth / requireAdmin / optionalAuth
│   │   │   └── error.ts        Global error handler
│   │   └── routes/
│   │       ├── auth.ts         POST /login, POST /register, GET /me
│   │       ├── rooms.ts        CRUD room types + physical rooms + inventory
│   │       ├── bookings.ts     Tạo/thanh toán/hủy booking + auto-release
│   │       ├── users.ts        CRUD users + đổi mật khẩu
│   │       ├── reviews.ts      CRUD reviews + admin moderation
│   │       ├── stats.ts        Dashboard stats (admin)
│   │       └── chatbot.ts      Gemini AI chatbot session
│   ├── .env                    PORT, DB_*, JWT_SECRET
│   ├── package.json            scripts: dev/build/start/db:init/db:seed
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
│   │   │   ├── constants.ts    SERVICE_FEE_RATE(5%), VAT_RATE(10%), filters
│   │   │   └── utils.ts        formatVND, date helpers
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx          Nav bar + auth state
│   │   │   │   ├── Footer.tsx          Footer
│   │   │   │   ├── AdminSidebar.tsx    Admin nav sidebar
│   │   │   │   ├── ProfileSidebar.tsx  User profile sidebar
│   │   │   │   └── ScrollToTop.tsx     Auto scroll on route change
│   │   │   ├── features/
│   │   │   │   ├── RoomCard.tsx        Card hiển thị loại phòng
│   │   │   │   ├── BookingCard.tsx     Card lịch sử đặt phòng
│   │   │   │   ├── ChatWidget.tsx      Floating chatbot widget
│   │   │   │   ├── SearchBar.tsx       Thanh tìm kiếm + date picker
│   │   │   │   └── StatCard.tsx        Card thống kê dashboard
│   │   │   └── ui/
│   │   │       ├── Badge.tsx           Badge component
│   │   │       ├── Button.tsx          Button component
│   │   │       ├── Card.tsx            Card wrapper
│   │   │       ├── Input.tsx           Input component
│   │   │       └── Toast.tsx           Toast notification + ToastProvider
│   │   ├── pages/
│   │   │   ├── Home.tsx                Trang chủ + recommendations
│   │   │   ├── RoomList.tsx            Danh sách phòng vật lý + filter
│   │   │   ├── RoomDetail.tsx          Chi tiết loại phòng (by type_id)
│   │   │   ├── PhysicalRoomDetail.tsx  Chi tiết phòng vật lý (by room_id)
│   │   │   ├── Checkout.tsx            Thanh toán đặt phòng
│   │   │   ├── BookingHistory.tsx      Lịch sử đặt phòng của user
│   │   │   ├── Profile.tsx             Trang cá nhân
│   │   │   ├── Login.tsx               Đăng nhập
│   │   │   ├── Register.tsx            Đăng ký
│   │   │   ├── AdminDashboard.tsx      (legacy redirect)
│   │   │   └── admin/
│   │   │       ├── AdminLayout.tsx     Layout admin với sidebar
│   │   │       ├── Dashboard.tsx       Thống kê tổng quan
│   │   │       ├── AdminRooms.tsx      Quản lý loại phòng
│   │   │       ├── AdminRoomTypes.tsx  Chi tiết loại phòng + units
│   │   │       ├── AdminRoomUnit.tsx   Chi tiết 1 phòng vật lý
│   │   │       ├── AdminRoomUnits.tsx  Danh sách tất cả phòng vật lý
│   │   │       ├── AdminBookings.tsx   Quản lý đặt phòng
│   │   │       ├── AdminUsers.tsx      Quản lý người dùng
│   │   │       ├── AdminReviews.tsx    Kiểm duyệt đánh giá
│   │   │       └── AdminSettings.tsx   Cài đặt khách sạn
│   │   └── types/
│   │       └── index.ts                TypeScript interfaces chung
│   ├── .env                    VITE_API_URL=http://localhost:4000/api
│   ├── vite.config.ts
│   └── package.json
│
├── PROJECT_WIKI.md             (file này)
├── PROJECT_STRUCTURE.md        Cấu trúc tóm tắt
└── schema_dump.sql             MySQL dump toàn bộ schema
```

---

## 4. DATABASE SCHEMA (24 bảng)

### Nhóm Phòng
| Bảng | Mô tả |
|---|---|
| `room_categories` | Phân loại phòng (Standard, Deluxe, Suite...) |
| `room_types` | Template loại phòng: tên, giá base, sức chứa, diện tích |
| `rooms` | Phòng vật lý: số phòng, tầng, trạng thái (ACTIVE/INACTIVE/MAINTENANCE/CLEANING) |
| `room_images` | Ảnh của từng phòng vật lý (MEDIUMTEXT url, hỗ trợ base64) |
| `room_inventory` | Lịch trống/bận theo ngày của từng phòng (AVAILABLE/PENDING/BOOKED/BLOCKED) |
| `room_prices` | Giá override theo ngày cho phòng vật lý |
| `room_type_prices` | Giá override theo ngày cho loại phòng |
| `amenities` | Danh sách tiện nghi |
| `room_type_amenities` | Quan hệ N-N: loại phòng ↔ tiện nghi |
| `bed_types` | Loại giường (Single, Double, King...) |
| `room_type_beds` | Loại giường + số lượng cho từng loại phòng |
| `pricing_rules` | Quy tắc phụ phí theo giờ check-in/check-out |

### Nhóm Người dùng
| Bảng | Mô tả |
|---|---|
| `users` | Tài khoản: username, password (bcrypt), full_name, email, phone |
| `roles` | Vai trò: USER, ADMIN |
| `user_roles` | Quan hệ N-N: user ↔ role |

### Nhóm Đặt phòng
| Bảng | Mô tả |
|---|---|
| `bookings` | Đơn đặt phòng: status (PENDING/CONFIRMED/COMPLETED/CANCELLED), expires_at |
| `booking_rooms` | Chi tiết phòng trong booking: check_in, check_out, giờ, giá |
| `booking_guests` | Thông tin khách trong booking |
| `payment_transactions` | Giao dịch thanh toán: method, status (PENDING/SUCCESS/FAILED) |

### Nhóm Khác
| Bảng | Mô tả |
|---|---|
| `reviews` | Đánh giá: rating 1-5, comment, status (VISIBLE/HIDDEN), unique(user_id, booking_id) |
| `hotel_info` | Thông tin khách sạn (tên, địa chỉ, SĐT) |
| `chatbot_sessions` | Phiên chat AI |
| `chatbot_messages` | Tin nhắn trong phiên chat |
| `activity_logs` | Log hành động: LOGIN, REGISTER, CREATE_BOOKING, PAY_BOOKING... |

### Trigger quan trọng
```sql
-- Tự động sync is_available khi status thay đổi
TRIGGER trg_sync_is_available BEFORE UPDATE ON room_inventory
  SET NEW.is_available = (NEW.status = 'AVAILABLE');
```

### Indexes quan trọng
- `room_inventory`: `(room_id, date, status)` — tối ưu query kiểm tra phòng trống
- `reviews`: `(room_type_id)`, `(status)` — tối ưu filter đánh giá
- `booking_rooms`: `(room_id)` — tối ưu kiểm tra conflict booking

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
| GET | `/rooms/all-units` | 🔓 | Tất cả phòng vật lý (filter + date range) |
| GET | `/rooms/available` | 🔓 | Phòng còn trống theo check_in/check_out (dùng room_inventory) |
| GET | `/rooms/recommendations` | 🔓 | Gợi ý phòng thông minh (AI scoring) |
| GET | `/rooms/categories/list` | 🔓 | Danh sách categories |
| GET | `/rooms/bed-types/list` | 🔓 | Danh sách loại giường |
| GET | `/rooms/physical/:room_id` | 🔓 | Chi tiết phòng vật lý (ảnh, tiện nghi, giá) |
| GET | `/rooms/physical/:room_id/availability` | 🔓 | Ngày không khả dụng của phòng |
| GET | `/rooms/physical/:room_id/similar` | 🔓 | Phòng tương tự (cùng type, còn trống) |
| GET | `/rooms/pricing-rules` | 🔓 | Quy tắc phụ phí check-in/out |
| GET | `/rooms/:type_id/units` | 👑 | Danh sách phòng vật lý theo loại |
| POST | `/rooms/:type_id/units` | 👑 | Thêm phòng vật lý |
| PATCH | `/rooms/units/:room_id` | 👑 | Cập nhật phòng vật lý |
| DELETE | `/rooms/units/:room_id` | 👑 | Xóa phòng vật lý |
| GET | `/rooms/units/:room_id/detail` | 👑 | Chi tiết đầy đủ phòng vật lý |
| GET | `/rooms/units/:room_id/price` | 👑 | Giá hiện tại (base + override) |
| PUT | `/rooms/units/:room_id/price` | 👑 | Đặt giá override |
| DELETE | `/rooms/units/:room_id/price` | 👑 | Xóa giá override (về base) |
| GET | `/rooms/units/:room_id/images` | 👑 | Danh sách ảnh phòng |
| POST | `/rooms/units/:room_id/images` | 👑 | Thêm ảnh |
| DELETE | `/rooms/images/:image_id` | 👑 | Xóa ảnh |
| GET | `/rooms/units/:room_id/bookings` | 👑 | Lịch sử booking của phòng |
| PATCH | `/rooms/units/:room_id/type` | 👑 | Đổi loại phòng |
| POST | `/rooms/units/:room_id/retype` | 👑 | Tạo/tái sử dụng loại phòng mới cho phòng |
| GET | `/rooms/admin/units-status` | 👑 | Trạng thái tất cả phòng theo ngày |
| GET | `/rooms/:type_id/amenities` | 👑 | Tiện nghi của loại phòng |
| POST | `/rooms/:type_id/amenities` | 👑 | Thêm tiện nghi |
| DELETE | `/rooms/:type_id/amenities/:id` | 👑 | Xóa tiện nghi |
| GET | `/rooms/:type_id/beds` | 👑 | Giường của loại phòng |
| POST | `/rooms/:type_id/beds` | 👑 | Thêm giường |
| DELETE | `/rooms/:type_id/beds/:id` | 👑 | Xóa giường |

### /api/bookings
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/bookings` | 🔑 | User: booking của mình · Admin: tất cả (filter date) |
| POST | `/bookings` | 🔑 | Tạo booking mới (transaction-safe, lock inventory) |
| GET | `/bookings/:id` | 🔑 | Chi tiết booking (rooms + guests + payments) |
| PATCH | `/bookings/:id/pay` | 🔑 | Thanh toán booking (PENDING → CONFIRMED) |
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
| GET | `/reviews/admin/stats` | 👑 | Thống kê đánh giá |
| PATCH | `/reviews/:id/visibility` | 👑 | Ẩn/hiện đánh giá |
| DELETE | `/reviews/:id` | 👑 | Xóa đánh giá |

### /api/users
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/users` | 👑 | Danh sách users (filter date) |
| GET | `/users/:id` | 🔑 | Chi tiết user (chỉ xem của mình hoặc admin) |
| PATCH | `/users/:id` | 🔑 | Cập nhật full_name, phone |
| PATCH | `/users/:id/password` | 🔑 | Đổi mật khẩu |
| GET | `/users/:id/bookings` | 🔑 | Lịch sử booking của user |
| DELETE | `/users/:id` | 👑 | Xóa user (soft delete nếu có booking) |

### /api/stats
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/stats` | 👑 | Doanh thu, số booking, phòng trống, users, recent bookings |

### /api/chatbot
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/chatbot/message` | 🔓 | Gửi tin nhắn, nhận phản hồi từ Gemini AI |

### /api/health
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/health` | 🔓 | Health check server |

---

## 6. FRONTEND COMPONENTS & PAGES

### Routes (App.tsx)
| Path | Component | Mô tả |
|---|---|---|
| `/` | Home | Trang chủ, recommendations |
| `/rooms` | RoomList | Danh sách phòng vật lý + filter |
| `/rooms/:id` | RoomDetail | Chi tiết loại phòng |
| `/room/:room_id` | PhysicalRoomDetail | Chi tiết phòng vật lý cụ thể |
| `/checkout` | Checkout | Thanh toán (nhận state từ navigate) |
| `/profile` | Profile | Trang cá nhân user |
| `/history` | BookingHistory | Lịch sử đặt phòng |
| `/login` | Login | Đăng nhập |
| `/register` | Register | Đăng ký |
| `/admin` | AdminLayout | Layout admin (Outlet) |
| `/admin/` | Dashboard | Thống kê tổng quan |
| `/admin/rooms` | AdminRooms | Quản lý loại phòng |
| `/admin/rooms/:typeId` | AdminRoomTypes | Chi tiết loại phòng + units |
| `/admin/rooms/:typeId/units/:roomId` | AdminRoomUnit | Chi tiết 1 phòng vật lý |
| `/admin/room-units` | AdminRoomUnits | Tất cả phòng vật lý |
| `/admin/users` | AdminUsers | Quản lý users |
| `/admin/bookings` | AdminBookings | Quản lý bookings |
| `/admin/reviews` | AdminReviews | Kiểm duyệt reviews |
| `/admin/settings` | AdminSettings | Cài đặt khách sạn |

### Providers (bọc toàn app)
- `AuthProvider` — quản lý user/token trong localStorage + React Context
- `ToastProvider` — hệ thống thông báo toast toàn app

### Layout Components
| Component | Tác dụng |
|---|---|
| `Header.tsx` | Navbar: logo, nav links, auth state (login/logout/avatar) |
| `Footer.tsx` | Footer thông tin khách sạn |
| `AdminSidebar.tsx` | Sidebar điều hướng admin |
| `ProfileSidebar.tsx` | Sidebar trang cá nhân user |
| `ScrollToTop.tsx` | Tự scroll lên đầu khi đổi route |

### Feature Components
| Component | Tác dụng |
|---|---|
| `RoomCard.tsx` | Card hiển thị loại phòng: ảnh, tên, giá, tiện nghi, nút đặt |
| `BookingCard.tsx` | Card lịch sử booking: trạng thái, ngày, giá, nút hủy/đánh giá |
| `ChatWidget.tsx` | Floating button mở chatbot AI (Gemini) |
| `SearchBar.tsx` | Thanh tìm kiếm với date picker check-in/out |
| `StatCard.tsx` | Card thống kê admin (doanh thu, phòng trống...) |

### UI Components
| Component | Tác dụng |
|---|---|
| `Badge.tsx` | Badge màu sắc (info/success/warning/default) |
| `Button.tsx` | Button với variants và loading state |
| `Card.tsx` | Container card với shadow/border |
| `Input.tsx` | Input field có label và error state |
| `Toast.tsx` | Toast notification (success/error/info) + ToastProvider |

### Lib / Utilities
| File | Tác dụng |
|---|---|
| `api.ts` | Tất cả API calls: `authApi`, `roomApi`, `bookingApi`, `reviewApi`, `userApi`, `adminRoomApi`, `availableRoomsApi`, `publicRoomApi`, `statsApi` |
| `auth.tsx` | `AuthProvider`, `useAuth()` hook, `AuthUser` interface |
| `constants.ts` | `SERVICE_FEE_RATE=0.05`, `VAT_RATE=0.10`, filter options |
| `utils.ts` | `formatVND()`, date helpers |

---

## 7. BUSINESS LOGIC — ĐIỂM KHÁC BIỆT

### 7.1 Mô hình phòng 2 tầng
Hệ thống tách biệt **loại phòng** (template) và **phòng vật lý** (instance):
- `room_types`: định nghĩa tên, giá base, tiện nghi, giường — dùng chung cho nhiều phòng
- `rooms`: phòng thực tế có số phòng, tầng, trạng thái riêng
- Một loại phòng có thể có nhiều phòng vật lý (VD: "Deluxe" có phòng 101, 201, 301)

### 7.2 Hệ thống giá 3 tầng (Price Priority)
```
Giá hiệu lực = room_prices (override ngày cụ thể)
             ?? room_type_prices (override theo loại)
             ?? room_types.base_price (giá gốc)
```

### 7.3 Phụ phí theo giờ (pricing_rules)
Phụ phí check-in sớm và check-out muộn được tính theo `pricing_rules`:
```
Check-in sớm:
  05:00–09:00 → +50% giá 1 đêm
  09:00–14:00 → +30% giá 1 đêm

Check-out muộn:
  12:00–15:00 → +30% giá 1 đêm
  15:00–18:00 → +50% giá 1 đêm
  18:00+      → +100% giá 1 đêm
```

### 7.4 Booking Transaction-Safe với room_inventory
Khi tạo booking:
1. `SELECT ... FOR UPDATE` lock các row inventory → tránh double booking
2. Nếu không có inventory → fallback kiểm tra conflict qua `booking_rooms`
3. Booking tạo ra với `status=PENDING` và `expires_at = NOW + 10 phút`
4. Sau khi thanh toán → `status=CONFIRMED`, xóa `expires_at`

### 7.5 Auto-Release Expired Bookings
Job chạy mỗi 60 giây:
- Tìm booking `PENDING` đã quá `expires_at`
- Khôi phục `room_inventory` về `AVAILABLE`
- Chuyển booking sang `CANCELLED`

### 7.6 Smart Room Recommendation (AI Scoring)
Endpoint `/rooms/recommendations` tính điểm cho từng loại phòng:
```
score = 0.4 × type_match      (user đã từng đặt loại này)
      + 0.2 × rating           (điểm đánh giá trung bình)
      + 0.2 × price_proximity  (gần với mức giá user hay đặt)
      + 0.1 × amenity_match    (tiện nghi khớp với lịch sử)
      + 0.1 × popularity       (số lượt đặt)
```
Nếu user chưa có lịch sử → sort theo rating + popularity.

### 7.7 Smart Retype Room (retypeRoom)
Khi admin đổi loại phòng cho 1 phòng vật lý:
- Hệ thống tìm xem đã có `room_type` nào khớp hoàn toàn (giá, sức chứa, giường) chưa
- Nếu có → tái sử dụng, không tạo mới (tránh duplicate)
- Nếu không → tạo `room_type` mới trong transaction

### 7.8 Soft Delete User
Khi admin xóa user có booking:
- Không xóa cứng (giữ toàn vẹn dữ liệu booking)
- Anonymize: username → `deleted_{id}`, email → `deleted_{id}@removed.local`, full_name → `[Đã xóa]`
- Xóa role

### 7.9 Công thức tính giá booking
```
subtotal     = base_price_per_night × số_đêm
early_fee    = calcEarlyFee(check_in_time, base_per_night)
late_fee     = calcLateFee(check_out_time, base_per_night)
total_price  = (subtotal + early_fee + late_fee) × 1.15  (+15% VAT+service)
```
Frontend hiển thị chi tiết: service fee (5%) + VAT (10%) tách riêng.

### 7.10 Review Constraints
- Chỉ đánh giá được booking có `status=COMPLETED`
- Mỗi user chỉ đánh giá 1 lần / 1 booking (`UNIQUE KEY unique_review(user_id, booking_id)`)
- Review gắn với `room_type_id` (không phải phòng vật lý cụ thể)
- Admin có thể ẩn/hiện review (VISIBLE/HIDDEN), public chỉ thấy VISIBLE

---

## 8. FLOW QUAN TRỌNG

### Flow 1: Đăng ký / Đăng nhập
```
User nhập form
  → POST /api/auth/register hoặc /login
  → BE: hash password (bcrypt), tạo JWT (7d)
  → FE: lưu token + user vào localStorage
  → AuthContext cập nhật state
  → Redirect về trang chủ
```

### Flow 2: Tìm kiếm & Đặt phòng
```
1. User vào /rooms → GET /api/rooms/all-units (filter giá, sức chứa, ngày)
2. Click phòng → /room/:room_id → GET /api/rooms/physical/:room_id
3. Chọn ngày check-in/out + giờ → tính giá realtime (frontend)
4. Click "Đặt phòng" → navigate('/checkout', { state: { ...booking_data } })
5. Checkout page → POST /api/bookings
   - BE: lock room_inventory FOR UPDATE
   - Kiểm tra availability
   - Tạo booking PENDING (expires 10 phút)
   - Tạo payment_transaction PENDING
6. User xác nhận thanh toán → PATCH /api/bookings/:id/pay
   - BE: kiểm tra expires_at chưa hết hạn
   - Cập nhật payment → SUCCESS
   - Cập nhật booking → CONFIRMED
7. Redirect → /history
```

### Flow 3: Auto-Release Booking Hết Hạn
```
setInterval(60s):
  SELECT booking PENDING + expires_at < NOW()
  → UPDATE room_inventory SET status='AVAILABLE'
  → UPDATE booking SET status='CANCELLED'
```

### Flow 4: Admin Quản lý Phòng
```
/admin/rooms → danh sách room_types
  → click type → /admin/rooms/:typeId
    → xem danh sách phòng vật lý (units)
    → click unit → /admin/rooms/:typeId/units/:roomId
      → xem/sửa: số phòng, tầng, trạng thái, ghi chú
      → quản lý ảnh (upload base64 URL)
      → đặt giá override (room_prices)
      → đổi loại phòng (retype với smart reuse)
      → xem lịch sử booking của phòng
```

### Flow 5: Đánh giá
```
User vào /history → thấy booking COMPLETED
  → click "Đánh giá"
  → POST /api/reviews { booking_id, rating, comment }
  → BE: kiểm tra booking thuộc user + status=COMPLETED
  → BE: kiểm tra chưa đánh giá (unique constraint)
  → Lưu review với room_type_id (lấy từ booking_rooms → rooms → type_id)
```

### Flow 6: Chatbot AI
```
User click ChatWidget → mở chat panel
  → POST /api/chatbot/message { message, session_id }
  → BE: gửi đến Gemini API với context khách sạn
  → Lưu chatbot_messages
  → Trả về phản hồi AI
```

---

## 9. CONSTRAINTS & RULES

### Database Constraints
- `rooms.room_number` — UNIQUE (không trùng số phòng)
- `reviews.unique_review(user_id, booking_id)` — 1 user chỉ review 1 lần / booking
- `room_inventory.UNIQUE(room_id, date)` — 1 phòng chỉ có 1 record / ngày
- `room_prices.UNIQUE(room_id, date)` — 1 giá override / phòng / ngày
- `reviews.rating CHECK (1-5)` — rating phải từ 1 đến 5
- `bookings.status ENUM` — chỉ nhận PENDING/CONFIRMED/COMPLETED/CANCELLED
- `rooms.status ENUM` — chỉ nhận ACTIVE/INACTIVE/MAINTENANCE/CLEANING

### Business Rules
- Booking chỉ tạo được khi phòng `status=ACTIVE`
- Booking PENDING tự hủy sau 10 phút nếu chưa thanh toán
- Không thể hủy booking đã `COMPLETED`
- Không thể xóa/sửa tài khoản ADMIN (kể cả admin khác)
- User có booking không bị xóa cứng (soft delete)
- Review chỉ tạo được từ booking `COMPLETED` của chính user đó
- Admin không thể tự xóa chính mình

### Auth Rules
- JWT hết hạn sau 7 ngày
- Token lưu trong `localStorage` (không dùng httpOnly cookie)
- `requireAdmin` kiểm tra `userRole === 'ADMIN'` từ JWT payload
- `optionalAuth` không reject nếu không có token (dùng cho recommendations)

### Pricing Rules
- Giá hiệu lực ưu tiên: `room_prices` > `base_price` (room_type)
- Phụ phí check-in/out tính trên giá 1 đêm (không phải tổng)
- Tổng giá = (base + early_fee + late_fee) × 1.15 (VAT 10% + service 5%)

### Image Rules
- Ảnh lưu dưới dạng URL hoặc base64 trong `room_images.url` (MEDIUMTEXT)
- Nếu phòng không có ảnh riêng → fallback lấy ảnh từ phòng cùng loại
- Script `fix-images.ts` sửa ảnh base64 bị split thành 2 record

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
```

### Frontend (FE/.env)
```env
VITE_API_URL=http://localhost:4000/api
# GEMINI_API_KEY=...   (optional, cho chatbot)
```

---

## 11. QUICK START

```bash
# 1. Khởi động MySQL, tạo database
mysql -u root -p
CREATE DATABASE IF NOT EXISTS smart_hotel;

# 2. Backend
cd BE
npm install
npm run db:init    # tạo schema
npm run db:seed    # dữ liệu mẫu
npm run dev        # chạy trên :4000

# 3. Frontend (terminal mới)
cd FE
npm install
npm run dev        # chạy trên :3000

# 4. Kiểm tra
curl http://localhost:4000/api/health
# → { "status": "ok" }
```

---

*Cập nhật lần cuối: 2026-04-17*
