# CẤU TRÚC CHI TIẾT DỰ ÁN SMARTHOTEL

Tài liệu này mô tả chi tiết toàn bộ cấu trúc thư mục, tệp tin và chức năng của từng thành phần trong hệ thống SmartHotel. Dự án được chia thành hai phần chính: Backend (BE - Node.js/Express) và Frontend (FE - React/Vite).

## Sơ đồ cây thư mục tổng quan

```text
demo_khoaluan/
├── BE/                         (Backend Node/Express/TypeScript)
│   ├── src/
│   │   ├── index.ts            Entry point — khởi tạo Express, mount routers
│   │   ├── db/                 Quản lý kết nối và schema Database
│   │   ├── middleware/         Bộ lọc request (auth, error)
│   │   ├── routes/             Định nghĩa các API Endpoints (Controller)
│   │   └── services/           Các dịch vụ nghiệp vụ (Chatbot AI, VNPay)
│   ├── migrations/             Các script cập nhật DB an toàn
│   ├── .env                    Biến môi trường Backend
│   └── package.json            Quản lý thư viện Backend
│
├── FE/                         (Frontend React/Vite/TypeScript)
│   ├── src/
│   │   ├── main.tsx            React DOM render root
│   │   ├── App.tsx             Định tuyến Router & Global Providers
│   │   ├── index.css           Tailwind base styles
│   │   ├── lib/                Thư viện tiện ích, API Wrapper, Helpers
│   │   ├── components/         UI Component (chia theo layout, feature, admin, ui)
│   │   └── pages/              Các màn hình/trang của người dùng & quản trị
│   ├── .env                    Biến môi trường Frontend
│   ├── vite.config.ts          Cấu hình đóng gói Vite
│   └── package.json            Quản lý thư viện Frontend
│
├── PROJECT_WIKI.md             Tài liệu thiết kế, API và Flow nghiệp vụ toàn dự án
├── CHATBOT_DOCUMENTATION.md    Tài liệu chi tiết kỹ thuật AI Chatbot
├── README.md                   Hướng dẫn cài đặt dự án nhanh
└── schema_dump.sql             Tệp sao lưu cấu trúc database (chỉ schema)
```

## 1. Thư mục gốc (Root Directory)
Thư mục gốc `d:\demo_khoaluan\` chứa cấu trúc tổng quan sau:

- **`BE/`**: Chứa toàn bộ mã nguồn Backend.
- **`FE/`**: Chứa toàn bộ mã nguồn Frontend.
- **`PROJECT_WIKI.md`**: Tài liệu thiết kế hệ thống, API, cấu trúc Database, logic giá 3 tầng (pricing logic) và quy trình nghiệp vụ (business flow). Đây là tài liệu cốt lõi của dự án.
- **`CHATBOT_DOCUMENTATION.md`**: Tài liệu kỹ thuật chuyên sâu về hệ thống AI Chatbot, mô tả cách LangChain và mô hình Ollama (Llama-3.2) hoạt động.
- **`README.md`**: Hướng dẫn cài đặt và chạy dự án (Quick Start).
- **`schema_dump.sql`**: Tệp lưu trữ bản sao cấu trúc của toàn bộ 25 bảng trong cơ sở dữ liệu MySQL (không chứa dữ liệu).

---

## 2. Chi tiết Backend (`/BE`)
Backend được xây dựng dựa trên Node.js, Express và TypeScript, quản lý toàn bộ cơ sở dữ liệu, nghiệp vụ (business logic) và cung cấp API RESTful cho Frontend.

### Thư mục `BE/src/` (Mã nguồn chính)
- **`index.ts`**: Điểm bắt đầu (Entry Point) của ứng dụng Backend. Nơi cấu hình Express, khởi tạo các Middleware (CORS, JSON parser) và liên kết các file định tuyến (Router).

#### `BE/src/db/` (Giao tiếp Cơ sở dữ liệu)
- **`client.ts`**: Chứa cấu hình Connection Pool dùng `mysql2/promise` để kết nối an toàn với MySQL.
- **`schema.ts`**: Script tự động tạo 25 bảng cơ sở dữ liệu dựa trên các mô hình đã định nghĩa.
- **`seed.ts`**: Script sinh dữ liệu mẫu (mock data) như người dùng, loại phòng, hóa đơn để phục vụ quá trình phát triển.
- **`test-connection.ts`**: Script nhỏ kiểm tra xem kết nối đến MySQL có thành công không.
- **`migrate_vnpay.ts` / `migrate_unique_order.ts`**: Các file cập nhật cấu trúc database (Migration) chuyên dụng cho luồng thanh toán VNPay.

#### `BE/src/middleware/` (Phần mềm trung gian)
- **`auth.ts`**: Chứa các hàm kiểm tra bảo mật (Xác minh JWT Token, kiểm tra quyền Admin, phân quyền User).
- **`error.ts`**: Hàm xử lý các lỗi (Error Handler) phát sinh trong toàn bộ quá trình gọi API và trả về định dạng chuẩn.

#### `BE/src/routes/` (Định tuyến API)
- **`auth.ts`**: API đăng nhập, đăng ký và lấy thông tin phiên (me).
- **`rooms.ts`**: API cực kỳ phức tạp xử lý phòng vật lý, loại phòng, xem lịch trống, lấy giá theo quy tắc 3 tầng (3-tier pricing logic) bằng đệ quy SQL.
- **`bookings.ts`**: API quản lý chu kỳ sống của đơn đặt phòng: khởi tạo, thanh toán một phần (VNPay/Cash), hủy đơn, auto-release đơn hết hạn.
- **`users.ts`**: API quản lý thông tin khách hàng (CRUD) và xử lý đổi mật khẩu.
- **`reviews.ts`**: API thêm, xóa, sửa, kiểm duyệt đánh giá của khách hàng về phòng.
- **`chatbot.ts`**: API nhận đầu vào từ Frontend và chuyển tới AI xử lý NLP (Natural Language Processing).
- **`hotel.ts`**: API lấy và cập nhật thông tin chung của khách sạn (tên, sđt, địa chỉ).
- **`stats.ts`**: API sinh biểu đồ và số liệu cho bảng điều khiển (Dashboard) của quản trị viên.

#### `BE/src/services/` (Các dịch vụ nghiệp vụ)
- **`vnpay.ts`**: Tích hợp SDK của VNPay. Tạo URL thanh toán và xác minh chữ ký mã hóa (HMAC-SHA512) khi VNPay gửi webhook trả về.
- **`chatbot/`** (Module Trí tuệ nhân tạo):
  - **`agent.ts / agent.js`**: Não bộ của AI, sử dụng LangChain và đồ thị ReAct (Reasoning and Acting) để quyết định xem khi nào cần truy vấn DB, khi nào chỉ cần trả lời thông thường.
  - **`prompt.js`**: Câu lệnh mồi (System Prompt) cấp nhân cách, hướng dẫn và giới hạn an toàn cho Chatbot.
  - **`tools.ts`**: Các công cụ (Hàm SQL) mà Chatbot có quyền gọi để tìm phòng trống, tìm thông tin đặt phòng mà không cần sự can thiệp của con người.

### Các thành phần khác của Backend
- **`BE/migrations/`**: Chứa các kịch bản `.sql` để cập nhật Database an toàn trên môi trường Production.
- **`BE/.env`**: Biến môi trường quan trọng (Mật khẩu DB, JWT Secret, Khóa bảo mật VNPay, Cổng Server).
- **`BE/package.json`**: Danh sách các thư viện Node.js và các lệnh chạy dự án (`npm run dev`, `npm run db:init`).

---

## 3. Chi tiết Frontend (`/FE`)
Frontend được phát triển bằng React 19, Vite, TypeScript và Tailwind CSS v4. Áp dụng kiến trúc tách biệt UI Components và Pages.

### Thư mục `FE/src/` (Mã nguồn chính)
- **`main.tsx`**: Tệp khởi chạy của React, kết nối App vào cây DOM HTML.
- **`App.tsx`**: Xương sống của ứng dụng FE, thiết lập cấu hình React Router (chuyển trang) và cung cấp Global State (Context API).
- **`index.css`**: Nơi import và cấu hình hệ thống thiết kế (Design System) của Tailwind.

#### `FE/src/lib/` (Thư viện tiện ích)
- **`api.ts`**: Lớp bao bọc (Wrapper) các lệnh gọi fetch() tới Backend. Quản lý việc đính kèm Token bảo mật tự động vào mỗi Request.
- **`auth.tsx`**: React Context duy trì trạng thái đăng nhập của người dùng trên toàn bộ ứng dụng.
- **`constants.ts`**: Các hằng số (Biến tĩnh) không thay đổi, ví dụ định dạng tiền tệ mặc định, URL ảnh dự phòng.
- **`redirectToLogin.ts`**: Logic lưu trữ URL hiện tại khi người dùng chưa đăng nhập, để tự động chuyển hướng lại đúng trang đó sau khi đăng nhập thành công.
- **`utils.ts`**: Các hàm tính toán nhỏ, định dạng ngày tháng, tiền tệ.

#### `FE/src/components/` (Các khối giao diện tái sử dụng)
- **`layout/`**: Thành phần hiển thị trên mọi trang (Header, Footer, ProfileSidebar, nút ScrollToTop).
- **`features/`**: Các cụm giao diện có chức năng nghiệp vụ phức tạp.
  - `RoomCard.tsx` / `BookingCard.tsx`: Thẻ hiển thị thông tin phòng hoặc chi tiết hóa đơn đặt phòng.
  - `ChatWidget.tsx`: Cửa sổ nổi hiển thị trợ lý AI ở góc phải màn hình.
  - `SearchBar.tsx`: Thanh tìm kiếm phòng trung tâm (Lọc theo ngày, số người).
- **`ui/`**: Các thành phần nguyên thủy thiết kế theo Design System (Button, Input, Card, Badge, Toast notifications).
- **`admin/`**: Các thành phần riêng cho quyền Quản trị (Bộ lọc thời gian, biểu đồ thống kê).

#### `FE/src/pages/` (Các trang hiển thị toàn màn hình)
- **`Home.tsx`**: Trang chủ (Landing Page) hiển thị quảng cáo phòng và đề xuất thông minh.
- **`RoomList.tsx`**: Danh sách tất cả các phòng vật lý và hệ thống bộ lọc nâng cao.
- **`RoomDetail.tsx`**: Màn hình xem chi tiết tổng quan một "Loại phòng" (Ví dụ: Deluxe).
- **`PhysicalRoomDetail.tsx`**: Màn hình cực kỳ phức tạp mô phỏng Airbnb để đặt riêng biệt từng "Phòng vật lý" (Ví dụ: Phòng 101). Hiển thị lịch trống và giá 3 tầng theo từng ngày.
- **`Checkout.tsx`**: Quy trình thanh toán đặt phòng (Kiểm tra điều khoản, chọn mức đặt cọc, thanh toán VNPay).
- **`BookingHistory.tsx`**: Trang cá nhân cho khách xem tình trạng các đơn đặt (Pending, Confirmed, Cancelled).
- **`VNPayReturn.tsx`**: Màn hình xử lý và thông báo kết quả sau khi VNPay thanh toán xong và chuyển hướng về.
- **`Login.tsx` / `Register.tsx`**: Trang xác thực tài khoản.
- **`About.tsx` / `Services.tsx` / `Contact.tsx`**: Các trang cung cấp thông tin tĩnh của khách sạn.
- **`admin/`** (Khu vực Quản trị - Cần quyền Admin):
  - `Dashboard.tsx`: Bảng điều khiển với biểu đồ doanh thu.
  - `AdminRooms.tsx` / `AdminRoomTypes.tsx`: Quản lý danh mục loại phòng.
  - `AdminRoomUnits.tsx`: Sơ đồ mô phỏng thực tế tất cả các phòng trong khách sạn, cập nhật trạng thái dọn dẹp, có khách trực tiếp mỗi 30s (Realtime Polling).
  - `AdminBookings.tsx` / `AdminInvoices.tsx`: Quản lý nghiệp vụ nhận/trả phòng và xuất hóa đơn.

### Các thành phần khác của Frontend
- **`FE/.env`**: Biến môi trường khai báo API kết nối (`VITE_API_URL=http://localhost:4000/api`).
- **`FE/vite.config.ts`**: Cấu hình công cụ Vite để tối ưu hóa quá trình biên dịch (Build) ứng dụng siêu nhanh.
- **`FE/package.json`**: Các thư viện như React Router v7, Tailwind v4, Framer Motion (Hoạt ảnh).
