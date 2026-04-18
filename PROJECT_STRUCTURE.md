# 📁 CẤU TRÚC PROJECT SMARTHOTEL

## 🗂️ TỔNG QUAN

```
SmartHotel/
├── BE/          # Backend (Node.js + Express + TypeScript + MySQL)
├── FE/          # Frontend (React 19 + Vite + TailwindCSS)
└── README.md
```

---

## 🔧 BACKEND (`BE/`)

### **Cấu hình & Khởi động**
| File | Tác dụng |
|------|----------|
| `BE/.env` | Biến môi trường (DB credentials, JWT secret, port) |
| `BE/.env.example` | Template cho `.env` |
| `BE/package.json` | Dependencies và scripts Node.js |
| `BE/tsconfig.json` | Cấu hình TypeScript compiler |
| `BE/src/index.ts` | **Entry point**: khởi tạo Express server, đăng ký routes, middleware, lắng nghe port 4000 |

### **Database (`BE/src/db/`)**
| File | Tác dụng |
|------|----------|
| `client.ts` | Tạo MySQL connection pool dùng chung toàn app |
| `schema.ts` | Script tạo 24 bảng DB (chạy `npm run db:init`) |
| `seed.ts` | Seed dữ liệu mẫu vào DB |
| `fix-images.ts` | Script sửa/cập nhật dữ liệu ảnh bị lỗi |
| `test-connection.ts` | Kiểm tra kết nối DB |

### **Migration Scripts**
| File | Tác dụng |
|------|----------|
| `BE/migrate-beds.mjs` | Migration dữ liệu loại giường |
| `BE/migrate-expires.mjs` | Thêm cột `expires_at` vào bảng `bookings` |
| `BE/migrate-review-reply.mjs` | (Deprecated) Thêm `admin_reply` — không dùng nữa |
| `BE/check-db.mjs` | Script nhanh kiểm tra DB từ CLI |

### **Middleware (`BE/src/middleware/`)**
| File | Tác dụng |
|------|----------|
| `auth.ts` | Xác thực JWT (`requireAuth`), kiểm tra quyền admin (`requireAdmin`) |
| `error.ts` | Global error handler: chuẩn hóa lỗi MySQL, JWT, trả JSON thống nhất |

### **Routes (`BE/src/routes/`) — API Endpoints**
| File | Endpoints | Tác dụng |
|------|-----------|----------|
| `auth.ts` | `/api/auth/*` | Đăng ký, đăng nhập, lấy thông tin user hiện tại |
| `rooms.ts` | `/api/rooms/*` | CRUD loại phòng, phòng vật lý, ảnh, giá override, tiện nghi, giường, kiểm tra phòng trống (`/available`) |
| `bookings.ts` | `/api/bookings/*` | Tạo booking (transaction-safe với `room_inventory`), thanh toán, xem/hủy/cập nhật trạng thái, auto-release expired bookings (job chạy mỗi 60s) |
| `users.ts` | `/api/users/*` | Quản lý user: xem, sửa, xóa (soft delete nếu có booking), đổi mật khẩu |
| `reviews.ts` | `/api/reviews/*` | Xem/tạo/sửa đánh giá, admin ẩn/hiện/xóa review, thống kê review |
| `chatbot.ts` | `/api/chatbot/*` | Chatbot keyword-based: tạo session, gửi tin nhắn, lịch sử chat |
| `stats.ts` | `/api/stats` | Thống kê dashboard admin: doanh thu, số phòng trống, user, booking gần đây |

---

## 🎨 FRONTEND (`FE/`)

### **Cấu hình**
| File | Tác dụng |
|------|----------|
| `FE/.env` | Biến môi trường FE (API URL) |
| `FE/package.json` | Dependencies React/Vite |
| `FE/tsconfig.json` | Cấu hình TypeScript |
| `FE/vite.config.ts` | Cấu hình Vite build tool |
| `FE/index.html` | HTML entry point |

### **Core (`FE/src/`)**
| File | Tác dụng |
|------|----------|
| `main.tsx` | Mount React app vào DOM |
| `App.tsx` | Định nghĩa toàn bộ routing, bọc `AuthProvider` + `ToastProvider` |
| `index.css` | Global CSS (Tailwind imports) |

### **Lib — Utilities & Services (`FE/src/lib/`)**
| File | Tác dụng |
|------|----------|
| `api.ts` | **Tất cả API calls**: `authApi`, `roomApi`, `bookingApi`, `userApi`, `reviewApi`, `statsApi`, `adminRoomApi`, `availableRoomsApi` |
| `auth.tsx` | `AuthContext` + `AuthProvider`: quản lý state đăng nhập, lưu token/user vào localStorage |
| `utils.ts` | Helper functions: `formatVND`, `formatDate`, `formatTime`, `cn` (classnames), `generateBookingId` |
| `constants.ts` | Hằng số: VAT rate, service fee, danh sách quốc gia, loại phòng, sort options |

### **Types (`FE/src/types/`)**
| File | Tác dụng |
|------|----------|
| `index.ts` | TypeScript interfaces dùng chung: `Room`, `Booking`, `User`, `BookingStatus`... |

### **Pages — User (`FE/src/pages/`)**
| File | Route | Tác dụng |
|------|-------|----------|
| `Home.tsx` | `/` | Trang chủ: hero banner, phòng nổi bật, dịch vụ, giới thiệu, CTA |
| `RoomList.tsx` | `/rooms` | Danh sách phòng vật lý với bộ lọc (ngày, giá, loại, tầng), phân trang |
| `RoomDetail.tsx` | `/rooms/:id` | Chi tiết loại phòng: gallery ảnh, tiện nghi, đánh giá, form đặt phòng |
| `Checkout.tsx` | `/checkout` | Luồng thanh toán 2 bước: thông tin + chọn giờ check-in/out sớm/muộn → thanh toán với countdown 10 phút → xác nhận |
| `Profile.tsx` | `/profile` | Hồ sơ cá nhân: xem/sửa thông tin, đổi mật khẩu, thống kê booking |
| `BookingHistory.tsx` | `/history` | Lịch sử đặt phòng của user, lọc theo trạng thái, hủy booking, đánh giá phòng (tạo mới + chỉnh sửa) |
| `Login.tsx` | `/login` | Form đăng nhập |
| `Register.tsx` | `/register` | Form đăng ký tài khoản |

### **Pages — Admin (`FE/src/pages/admin/`)**
| File | Route | Tác dụng |
|------|-------|----------|
| `AdminLayout.tsx` | `/admin` | Layout admin với sidebar, bảo vệ route chỉ cho ADMIN |
| `Dashboard.tsx` | `/admin` (index) | Dashboard: thống kê tổng quan (doanh thu, phòng, user), booking gần đây, lọc theo ngày |
| `AdminRooms.tsx` | `/admin/rooms` | Quản lý loại phòng: CRUD, thêm/xóa tiện nghi và giường |
| `AdminRoomTypes.tsx` | `/admin/rooms/:typeId` | Chi tiết một loại phòng: danh sách phòng vật lý thuộc loại đó |
| `AdminRoomUnit.tsx` | `/admin/rooms/:typeId/units/:roomId` | Chi tiết một phòng vật lý: sửa thông tin, ảnh, giá override, đổi loại phòng, lịch sử booking |
| `AdminRoomUnits.tsx` | `/admin/room-units` | Xem tất cả phòng vật lý theo trạng thái trong ngày (AVAILABLE/BOOKED/CLEANING/MAINTENANCE) |
| `AdminBookings.tsx` | `/admin/bookings` | Quản lý tất cả booking: xem, cập nhật trạng thái, xóa, modal chi tiết với hoá đơn breakdown, in hoá đơn |
| `AdminUsers.tsx` | `/admin/users` | Quản lý user: xem danh sách, sửa, xóa (soft delete nếu có booking) |
| `AdminReviews.tsx` | `/admin/reviews` | Quản lý đánh giá: xem tất cả, thống kê (rating distribution), filter theo status/sao/phòng, ẩn/hiện/xóa review |
| `AdminSettings.tsx` | `/admin/settings` | Cài đặt khách sạn (thông tin, pricing rules...) |

### **Components — Layout (`FE/src/components/layout/`)**
| File | Tác dụng |
|------|----------|
| `Header.tsx` | Thanh điều hướng: logo, nav links, trạng thái đăng nhập, dropdown user |
| `Footer.tsx` | Footer chung |
| `AdminSidebar.tsx` | Sidebar điều hướng khu vực admin (Dashboard, Phòng, Booking, User, Review, Settings) |
| `ProfileSidebar.tsx` | Sidebar điều hướng khu vực profile user |

### **Components — Features (`FE/src/components/features/`)**
| File | Tác dụng |
|------|----------|
| `RoomCard.tsx` | Card hiển thị loại phòng (2 layout: grid cho Home, list cho RoomList), clickable navigate sang RoomDetail |
| `BookingCard.tsx` | Card hiển thị một booking trong lịch sử, clickable navigate sang RoomDetail, modal chi tiết booking với hoá đơn breakdown |
| `SearchBar.tsx` | Thanh tìm kiếm phòng (ngày nhận/trả, số khách) |
| `ChatWidget.tsx` | Widget chatbot nổi góc màn hình |
| `StatCard.tsx` | Card thống kê dùng trong dashboard admin |

### **Components — UI Base (`FE/src/components/ui/`)**
| File | Tác dụng |
|------|----------|
| `Button.tsx` | Button tái sử dụng với các variant (primary, secondary, danger, outline) |
| `Input.tsx` | Input, Select, Textarea có label và icon |
| `Card.tsx` | Wrapper card với shadow/border |
| `Badge.tsx` | Badge/tag hiển thị trạng thái (status, category) |
| `Toast.tsx` | Hệ thống thông báo toast toàn app (ToastProvider + useToast hook) |

### **Components — Admin (`FE/src/components/admin/`)**
| File | Tác dụng |
|------|----------|
| `DateRangeFilter.tsx` | Bộ lọc khoảng ngày dùng trong các trang admin (bookings, users, stats) |

### **Data**
| File | Tác dụng |
|------|----------|
| `FE/src/data/mock.ts` | Dữ liệu mock (dùng khi chưa có API hoặc test UI) |

---

## 🗄️ DATABASE SCHEMA (24 bảng)

### **Khách sạn & Phòng**
- `hotel_info` — thông tin khách sạn
- `room_categories` — hạng phòng (Standard, Deluxe, Suite...)
- `room_types` — loại phòng (tên, mô tả, giá base, sức chứa, diện tích)
- `rooms` — phòng vật lý (số phòng, tầng, trạng thái, ghi chú)
- `room_images` — ảnh phòng
- `room_inventory` — **nguồn sự thật về availability** (room_id, date, is_available, price)
- `room_prices` — giá override theo ngày cho từng phòng
- `room_type_prices` — giá override theo ngày cho loại phòng
- `amenities` — tiện nghi (Wifi, Hồ bơi, Spa...)
- `room_type_amenities` — liên kết loại phòng ↔ tiện nghi
- `bed_types` — loại giường (Single, Double, King...)
- `room_type_beds` — liên kết loại phòng ↔ giường (số lượng)

### **Pricing**
- `pricing_rules` — quy tắc giá theo giờ check-in/out (early/late fees)

### **User & Auth**
- `users` — tài khoản user (username, password hash, email, phone)
- `roles` — vai trò (USER, ADMIN)
- `user_roles` — liên kết user ↔ role

### **Booking**
- `bookings` — đặt phòng (user_id, total_price, status, **expires_at** — hết hạn sau 10 phút nếu chưa thanh toán)
- `booking_rooms` — chi tiết phòng trong booking (room_id, check_in, check_out, **check_in_time**, **check_out_time**, price)
- `booking_guests` — danh sách khách lưu trú
- `payment_transactions` — giao dịch thanh toán (amount, method, status)

### **Review**
- `reviews` — đánh giá (booking_id, user_id, **room_type_id**, rating, comment, **status** = VISIBLE/HIDDEN)

### **Chatbot**
- `chatbot_sessions` — session chat
- `chatbot_messages` — tin nhắn chat (sender: USER/BOT)

### **Logs**
- `activity_logs` — log hành động user (đăng ký, đăng nhập, tạo booking...)

---

## 🔑 TÍNH NĂNG CHÍNH

### **1. Hệ thống đặt phòng (Transaction-safe)**
- Tìm phòng trống theo `room_inventory` (nguồn sự thật duy nhất)
- Lock rows với `FOR UPDATE` để tránh double booking
- Tính phí early check-in / late check-out:
  - **Early**: 05:00–09:00 (+50%), 09:00–14:00 (+30%)
  - **Late**: 12:00–15:00 (+30%), 15:00–18:00 (+50%), 18:00+ (+100%)
- Booking `PENDING` có `expires_at = NOW + 10 phút`
- Auto-release job chạy mỗi 60s: hủy booking hết hạn, restore `room_inventory.is_available = 1`
- Thanh toán → `CONFIRMED`, xóa `expires_at`

### **2. Quản lý phòng**
- **Loại phòng** (room_types): CRUD, thêm tiện nghi, giường
- **Phòng vật lý** (rooms): gán loại phòng, đổi loại, giá override, ảnh riêng, ghi chú
- **Trạng thái phòng**: ACTIVE, INACTIVE, MAINTENANCE, CLEANING
- **Xem trạng thái theo ngày**: AVAILABLE, BOOKED, CLEANING (dựa vào booking + room_inventory)

### **3. Đánh giá (Review System)**
- User đánh giá sau khi booking COMPLETED
- Hiển thị ngay (`status = VISIBLE`)
- User có thể sửa đánh giá của mình
- Admin: ẩn/hiện/xóa review, xem thống kê (rating distribution, tổng số, điểm TB)
- Filter theo status, sao, phòng cụ thể
- Hiển thị thông tin phòng được đánh giá (ảnh, số phòng, tầng, loại)

### **4. Admin Dashboard**
- Thống kê: doanh thu, số booking, phòng trống, user
- Booking gần đây
- Filter theo khoảng ngày
- Export CSV

### **5. User Profile**
- Xem/sửa thông tin cá nhân
- Đổi mật khẩu (yêu cầu mật khẩu cũ)
- Thống kê: tổng booking, tổng chi tiêu, ngày tham gia

### **6. Authentication & Authorization**
- JWT-based auth
- Role-based access control (USER, ADMIN)
- Middleware `requireAuth`, `requireAdmin`
- Token lưu localStorage, tự động gửi trong header

---

## 📊 LUỒNG DỮ LIỆU QUAN TRỌNG

### **Booking Flow**
```
1. User chọn phòng + ngày → RoomDetail
2. Chọn giờ check-in/out (optional) → Checkout
3. Nhập thông tin → POST /api/bookings
   ├─ Lock room_inventory FOR UPDATE
   ├─ Check availability (count available days == nights)
   ├─ Calculate: base + early_fee + late_fee + VAT + service
   ├─ Insert booking (status=PENDING, expires_at=NOW+10min)
   ├─ Update room_inventory.is_available = 0
   └─ Insert booking_rooms, guests, payment (PENDING)
4. Countdown 10 phút → PATCH /api/bookings/:id/pay
   ├─ Check not expired
   ├─ Update payment.status = SUCCESS
   └─ Update booking.status = CONFIRMED, expires_at = NULL
5. Success screen
```

### **Review Flow**
```
1. User vào /history → load bookings + myReviews()
2. Booking COMPLETED chưa review → nút "Đánh giá"
3. Đã review → nút "Đã đánh giá ✏️" (click để sửa)
4. Modal tự nhận biết tạo mới hay sửa
5. POST /api/reviews → status = VISIBLE (hiện ngay)
6. PATCH /api/reviews/:id → cập nhật rating/comment
7. Admin: PATCH /api/reviews/:id/visibility → ẩn/hiện
```

### **Room Availability Logic**
```
- Có room_inventory data → dùng inventory (is_available)
- Không có inventory → fallback kiểm tra conflict qua booking_rooms
- Tính giá: ưu tiên từ room_inventory.price, fallback về room_types.base_price
```

---

## 🎯 API ENDPOINTS SUMMARY

### **Auth**
- `POST /api/auth/register` — đăng ký
- `POST /api/auth/login` — đăng nhập
- `GET /api/auth/me` — thông tin user hiện tại

### **Rooms**
- `GET /api/rooms` — list loại phòng (filter: price, capacity, dates)
- `GET /api/rooms/:type_id` — chi tiết loại phòng
- `GET /api/rooms/available?check_in=&check_out=` — phòng trống theo inventory
- `GET /api/rooms/all-units` — tất cả phòng vật lý (public)
- `POST /api/rooms` — tạo loại phòng (admin)
- `PUT /api/rooms/:type_id` — sửa loại phòng (admin)
- `DELETE /api/rooms/:type_id` — xóa loại phòng (admin)
- `GET /api/rooms/:type_id/units` — phòng vật lý thuộc loại (admin)
- `POST /api/rooms/:type_id/units` — thêm phòng vật lý (admin)
- `PATCH /api/rooms/units/:room_id` — sửa phòng vật lý (admin)
- `DELETE /api/rooms/units/:room_id` — xóa phòng vật lý (admin)
- `GET /api/rooms/units/:room_id/detail` — thông tin đầy đủ 1 phòng (admin)
- `GET /api/rooms/units/:room_id/images` — ảnh phòng (admin)
- `POST /api/rooms/units/:room_id/images` — thêm ảnh (admin)
- `DELETE /api/rooms/images/:image_id` — xóa ảnh (admin)
- `GET /api/rooms/units/:room_id/price` — giá hiện tại (admin)
- `PUT /api/rooms/units/:room_id/price` — set giá override (admin)
- `DELETE /api/rooms/units/:room_id/price` — reset về base_price (admin)
- `PATCH /api/rooms/units/:room_id/type` — đổi loại phòng (admin)
- `POST /api/rooms/units/:room_id/retype` — tạo loại mới + gán (admin)
- `GET /api/rooms/admin/units-status?date=` — trạng thái phòng theo ngày (admin)
- `GET /api/rooms/categories/list` — danh sách category
- `GET /api/rooms/bed-types/list` — danh sách loại giường

### **Bookings**
- `GET /api/bookings` — list booking (user: của mình, admin: tất cả)
- `GET /api/bookings/:id` — chi tiết booking
- `POST /api/bookings` — tạo booking mới
- `PATCH /api/bookings/:id/pay` — thanh toán booking
- `PATCH /api/bookings/:id/status` — cập nhật trạng thái (admin)
- `DELETE /api/bookings/:id` — user hủy booking
- `DELETE /api/bookings/:id/hard` — admin xóa cứng

### **Users**
- `GET /api/users` — list user (admin)
- `GET /api/users/:id` — chi tiết user
- `PATCH /api/users/:id` — sửa thông tin
- `PATCH /api/users/:id/password` — đổi mật khẩu
- `DELETE /api/users/:id` — xóa user (admin, soft delete nếu có booking)

### **Reviews**
- `GET /api/reviews?type_id=` — list review VISIBLE của loại phòng
- `GET /api/reviews/my` — review của user hiện tại
- `GET /api/reviews/admin` — admin xem tất cả (filter: status, type_id, rating, room_id)
- `GET /api/reviews/admin/stats` — thống kê review
- `POST /api/reviews` — tạo review
- `PATCH /api/reviews/:id` — user sửa review
- `PATCH /api/reviews/:id/visibility` — admin ẩn/hiện
- `DELETE /api/reviews/:id` — admin xóa

### **Stats**
- `GET /api/stats` — thống kê dashboard (admin, filter theo ngày)

### **Chatbot**
- `POST /api/chatbot/session` — tạo session
- `POST /api/chatbot/message` — gửi tin nhắn
- `GET /api/chatbot/history/:session_id` — lịch sử chat

---

## 🚀 CHẠY PROJECT

### **Backend**
```bash
cd BE
npm install
npm run db:init      # Tạo schema
npm run db:seed      # Seed data mẫu
node migrate-expires.mjs  # Migration expires_at
npm run dev          # Start server (port 4000)
```

### **Frontend**
```bash
cd FE
npm install
npm run dev          # Start dev server (port 5173)
```

### **Database Setup**
```sql
-- Thêm cột status vào reviews (chạy trong MySQL)
ALTER TABLE reviews
ADD COLUMN status ENUM('VISIBLE','HIDDEN') NOT NULL DEFAULT 'VISIBLE';
```

---

## 📝 GHI CHÚ KỸ THUẬT

- **Transaction-safe booking**: Dùng `FOR UPDATE` lock rows trong `room_inventory`
- **Auto-release expired bookings**: Job chạy mỗi 60s trong `bookings.ts`
- **Fallback logic**: Nếu không có `room_inventory` data → kiểm tra conflict qua `booking_rooms`
- **Soft delete users**: Nếu user có booking → ẩn thay vì xóa cứng
- **Review moderation**: Admin ẩn/hiện/xóa, user sửa được review của mình
- **Price calculation**: base_price × nights + early_fee + late_fee + VAT (10%) + service fee (5%)
- **JWT expires**: 7 ngày (cấu hình trong `.env`)
- **Booking expires**: 10 phút (hard-coded trong `bookings.ts`)

---

## 🔐 SECURITY

- Password hash với `bcryptjs` (10 rounds)
- JWT secret trong `.env`
- Middleware `requireAuth` check token mọi protected route
- Middleware `requireAdmin` check role = ADMIN
- SQL injection protection: dùng prepared statements (`conn.execute` với params)
- CORS enabled cho `localhost:3000` và `localhost:5173`

---

## 📦 DEPENDENCIES CHÍNH

### Backend
- `express` — web framework
- `mysql2` — MySQL driver với promise support
- `jsonwebtoken` — JWT auth
- `bcryptjs` — password hashing
- `cors` — CORS middleware
- `dotenv` — load .env
- `typescript` + `tsx` — TypeScript runtime

### Frontend
- `react` 19 + `react-dom` — UI library
- `react-router-dom` — routing
- `vite` — build tool
- `tailwindcss` — utility-first CSS
- `lucide-react` — icon library
- `motion` / `framer-motion` — animation library

---

**Tổng số file code chính: ~60 files**
**Tổng số API endpoints: ~70+ endpoints**
**Database tables: 24 bảng**
