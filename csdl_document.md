# Tài liệu Cơ Sở Dữ Liệu (CSDL) - Dự án Smart Hotel

Dưới đây là danh sách chi tiết tất cả các bảng trong cơ sở dữ liệu của dự án (`schema_dump.sql`) và mô tả chức năng, cũng như vị trí mà chúng được sử dụng trong hệ thống (Frontend & Backend).

## 1. Nhóm Người Dùng & Phân Quyền (Authentication & Authorization)
*   **`users`**: 
    *   *Chức năng*: Lưu trữ thông tin tài khoản của hệ thống bao gồm khách hàng, nhân viên, và quản trị viên.
    *   *Sử dụng ở đâu*: Các chức năng Đăng nhập, Đăng ký (Auth routes), trang Quản lý hồ sơ cá nhân (User Profile), và trang Quản lý người dùng của Admin.
*   **`roles`**: 
    *   *Chức năng*: Định nghĩa các vai trò trong hệ thống (Ví dụ: Admin, User, Staff).
    *   *Sử dụng ở đâu*: Dùng trong logic Middleware phân quyền (RBAC) để bảo vệ các route (ví dụ: chỉ Admin mới vào được `/admin/...`).
*   **`user_roles`**: 
    *   *Chức năng*: Bảng trung gian (N-N) liên kết người dùng (`users`) với vai trò của họ (`roles`).
    *   *Sử dụng ở đâu*: Xác định quyền hạn của user ngay lúc đăng nhập để trả về token tương ứng.
*   **`activity_logs`**: 
    *   *Chức năng*: Ghi lại lịch sử các thao tác quan trọng của người dùng hoặc admin (audit trail).
    *   *Sử dụng ở đâu*: Trang Dashboard Admin để theo dõi các hoạt động gần đây của hệ thống.

## 2. Nhóm Quản Lý Phòng & Danh Mục (Room & Categories)
*   **`room_categories`**: 
    *   *Chức năng*: Phân loại phòng theo các hạng mức (Ví dụ: Phòng Tiêu chuẩn, Phòng Cao cấp, Phòng Gia đình).
    *   *Sử dụng ở đâu*: Dùng để hiển thị trên thanh menu, bộ lọc tìm kiếm phòng ở Frontend.
*   **`room_types`**: 
    *   *Chức năng*: Định nghĩa thông tin chung của một kiểu phòng (Tên, giá gốc, sức chứa, diện tích).
    *   *Sử dụng ở đâu*: Đây là bảng lõi hiển thị dữ liệu chính trên trang Danh sách phòng, Trang chi tiết phòng (FE) và được Chatbot dùng làm dữ liệu phản hồi cho khách hàng (`search_rooms`).
*   **`rooms`**: 
    *   *Chức năng*: Quản lý các phòng vật lý thực tế của khách sạn (Số phòng 101, 102..., số tầng, trạng thái đang dọn dẹp/bảo trì).
    *   *Sử dụng ở đâu*: Sử dụng cực kỳ nhiều ở module Admin Quản lý phòng (`AdminRoomUnits`), giúp lễ tân xếp phòng cụ thể cho khách khi check-in.
*   **`room_images`**: 
    *   *Chức năng*: Lưu các đường dẫn ảnh chụp của loại phòng/phòng.
    *   *Sử dụng ở đâu*: Hiển thị Slider ảnh, Thumbnail ở Trang chủ và trang Chi tiết phòng.
*   **`amenities`**: 
    *   *Chức năng*: Danh sách các tiện ích có thể có (Wifi, TV, Ban công...).
    *   *Sử dụng ở đâu*: Liệt kê bộ lọc tiện ích và danh sách tiện nghi trong chi tiết phòng.
*   **`room_type_amenities`**: 
    *   *Chức năng*: Bảng trung gian liên kết loại phòng với các tiện ích của nó.
*   **`bed_types`**: 
    *   *Chức năng*: Từ điển các loại giường (Giường đơn, giường đôi, giường King).
*   **`room_type_beds`**: 
    *   *Chức năng*: Xác định trong một loại phòng có bao nhiêu chiếc giường và là loại giường gì.
    *   *Sử dụng ở đâu*: Phục vụ tính toán sức chứa tối đa của phòng và hiển thị mô tả cho khách trên Frontend.

## 3. Nhóm Quản Lý Tình Trạng & Giá (Inventory & Pricing)
*   **`room_inventory`**: 
    *   *Chức năng*: Bảng sống còn của hệ thống đặt phòng, ghi nhận xem phòng thực tế nào còn trống vào ngày nào, và giá bán trong ngày hôm đó là bao nhiêu.
    *   *Sử dụng ở đâu*: Logic kiểm tra khả dụng khi khách thao tác đặt phòng, thuật toán của Tool `search_rooms` (Chatbot) để gợi ý phòng trống, và hiển thị biểu đồ timeline đặt phòng cho Lễ tân.
*   **`room_prices`** & **`room_type_prices`**: 
    *   *Chức năng*: Cho phép ghi đè giá cơ bản theo từng ngày cụ thể (Ví dụ: set giá riêng cho các ngày Lễ, cuối tuần).
    *   *Sử dụng ở đâu*: Logic tính toán tổng tiền khi khách chọn khoảng thời gian check-in/out.
*   **`pricing_rules`**: 
    *   *Chức năng*: Cấu hình các quy tắc phụ thu giá trị linh hoạt (Nhận phòng sớm tính thêm % tiền, trả muộn tính thêm % tiền).
    *   *Sử dụng ở đâu*: Được gọi trong các tính toán chi phí phát sinh lúc khách check-out tại quầy hoặc lúc tạo hóa đơn (Invoices).

## 4. Nhóm Đặt Phòng (Bookings)
*   **`bookings`**: 
    *   *Chức năng*: Hồ sơ chính của một giao dịch đặt phòng (Chứa Tổng tiền, Trạng thái: Pending/Confirmed/Cancelled, Chính sách thanh toán, Số tiền đã cọc).
    *   *Sử dụng ở đâu*: Trang Lịch sử đặt phòng (User FE), Quản lý Booking (Admin FE), Tính toán doanh thu trên Dashboard.
*   **`booking_rooms`**: 
    *   *Chức năng*: Chi tiết các phòng cụ thể được chọn trong một đơn `bookings`, kèm ngày check-in/out và giá riêng của từng phòng đó.
    *   *Sử dụng ở đâu*: Hiển thị hóa đơn chi tiết, đồng thời dữ liệu này sẽ được đồng bộ (trigger/sync) sang `room_inventory` để khóa phòng (chuyển sang trạng thái Booked).
*   **`booking_guests`**: 
    *   *Chức năng*: Lưu thông tin danh tính của người đại diện hoặc danh sách khách lưu trú thực tế.
    *   *Sử dụng ở đâu*: Form điền thông tin đặt phòng bước cuối và dùng cho lễ tân khai báo lưu trú.
*   **`bookings_backup`**: 
    *   *Chức năng*: Lưu trữ dự phòng dữ liệu đặt phòng.

## 5. Nhóm Thanh Toán (Payment & Finance)
*   **`payment_transactions`**: 
    *   *Chức năng*: Ghi lại thông tin về một giao dịch chuyển tiền qua MoMo, VNPay hoặc Tiền mặt (Mã giao dịch đối tác, số tiền, loại thanh toán là đặt cọc hay trả đủ).
    *   *Sử dụng ở đâu*: Quá trình checkout trên FE chuyển hướng tới Cổng thanh toán, và Route nhận Webhook/IPN trên BE (Ví dụ: `routes/vnpay`) để tự động đổi trạng thái `bookings` thành Đã thanh toán.
*   **`payment_logs`**: 
    *   *Chức năng*: Lưu log lại toàn bộ phản hồi từ đối tác thanh toán để tra soát lỗi (debug VNPay sandbox).
    *   *Sử dụng ở đâu*: Chỉ dành cho Developer hoặc Admin tra cứu khi khách báo trừ tiền nhưng chưa nhận phòng.
*   **`payment_transactions_backup`**: 
    *   *Chức năng*: Bảng sao lưu các lịch sử thanh toán.

## 6. Nhóm Chatbot Trợ Lý Cục Bộ (AI Agent)
*   **`chatbot_sessions`**: 
    *   *Chức năng*: Định danh một phiên làm việc (cuộc trò chuyện) giữa một khách hàng với Chatbot.
    *   *Sử dụng ở đâu*: Module `chatbot/session.ts` ở BE để duy trì Context, giúp Chatbot nhớ được khách hàng đang định đặt phòng gì hoặc bao nhiêu người.
*   **`chatbot_messages`**: 
    *   *Chức năng*: Lưu lại toàn bộ tin nhắn qua lại (User và Bot) trong một phiên.
    *   *Sử dụng ở đâu*: Cung cấp lịch sử chat để hiển thị trên Component `ChatWidget` trên Frontend.

## 7. Nhóm Thông Tin Mở Rộng (Hotel Info & Reviews)
*   **`reviews`**: 
    *   *Chức năng*: Khách hàng chấm điểm (rating) và viết bình luận sau khi sử dụng dịch vụ.
    *   *Sử dụng ở đâu*: Component hiển thị Review dưới đáy trang Chi tiết phòng, và trang quản lý Đánh giá để Admin duyệt/ẩn bình luận spam.
*   **`hotel_info`**: 
    *   *Chức năng*: Cấu hình các thông tin cơ bản của khách sạn (Tên, địa chỉ, Hotline, mô tả).
    *   *Sử dụng ở đâu*: Đổ dữ liệu động ra Footer trang web, Component Liên Hệ, và in trên Header của mẫu Hóa Đơn xuất (Invoices/Export PDF).
