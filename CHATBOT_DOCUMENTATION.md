# Tài liệu Chatbot SmartHotel

## 1. Tổng quan

Chatbot SmartHotel là trợ lý AI tích hợp trực tiếp vào giao diện web, hỗ trợ khách hàng tìm phòng, tra cứu giá, kiểm tra đặt phòng và giải đáp chính sách khách sạn bằng tiếng Việt.

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| LLM (Local AI) | **Ollama** — model `llama3.2:3b` chạy tại `localhost:11434` |
| Agent Framework | **LangChain / LangGraph** — `createReactAgent` (ReAct pattern) |
| Tool Schema | **Zod** — validate input/output của từng tool |
| Database | **MySQL** (mysql2/promise) — pool connection |
| Session Storage | **Redis** (fallback: in-memory RAM) — TTL 2 giờ |
| Backend | **Express.js** + TypeScript |
| Frontend | **React** + TypeScript (ChatWidget component) |
| HTTP Client | Axios (qua `post()` helper trong `api.ts`) |

---

## 3. Cấu trúc file

```
BE/src/services/chatbot/
├── agent.js       — Điều phối chính: intent detection + routing
├── tools.js       — 4 LangChain tools gọi DB
├── nlu.js         — NLU: parse tiếng Việt → entities
├── knowledge.js   — Knowledge base tĩnh (FAQ / chính sách)
├── context.js     — Cập nhật context hội thoại từ NLU
├── session.js     — Quản lý session (Redis / RAM)
├── prompt.js      — System prompts cho LLM
├── date.js        — Tiện ích xử lý ngày tháng
└── db.js          — Khởi tạo Ollama LLM + MySQL pool

BE/src/routes/
└── chatbot.ts     — Express route: POST /api/chatbot/message

FE/src/components/features/
└── ChatWidget.tsx — UI chat nổi (floating widget)

FE/src/lib/
└── api.ts         — chatbotApi.sendMessage()
```

---

## 4. Luồng hoạt động chính

### 4.1 Luồng tổng quát

```
User nhập tin nhắn
        │
        ▼
[ChatWidget.tsx] sendMessage()
        │  POST /api/chatbot/message  { sessionId, message }
        ▼
[chatbot.ts route] → runAgent(message, sessionId)
        │
        ▼
[agent.js] runAgent()
        │
        ├─ quickIntent()  ← keyword matching (không gọi LLM)
        │       │ null
        │       ▼
        │  llmText.invoke(INTENT_PROMPT)  ← LLM fallback
        │
        ├── intent = "general_info"  → knowledge.js retrieveContext()  → trả lời tĩnh
        │
        ├── intent = "ask_availability" / "ask_price"
        │       └── searchRooms.invoke({ people, max_price })  → MySQL → trả về danh sách phòng
        │
        ├── intent = "ask_booking"
        │       └── ReAct Agent → getBooking tool → MySQL
        │
        └── intent = "other"
                └── ReAct Agent (llm + tools) → xử lý tổng quát
                        │
                        └── safeParseJSON(response) → { text, rooms }
        │
        ▼
[chatbot.ts route] res.json({ success, data: { message, rooms } })
        │
        ▼
[ChatWidget.tsx] render tin nhắn + RoomCard nếu có rooms[]
```

### 4.2 Luồng NLU (Natural Language Understanding)

```
Input text (tiếng Việt)
        │
        ▼
normalizeText()  ← chuẩn hóa: lowercase, sửa typo phổ biến
        │
        ├── detectIntent()     → greeting / search / book / policy / ...
        ├── parsePrice()       → { min_price, max_price }
        ├── parsePeople()      → { adults, children, childrenAges }
        ├── parseDateRange()   → { checkin, checkout }
        ├── parseRoomType()    → "Suite" / "Deluxe" / "Standard" / ...
        ├── parseAmenities()   → ["wifi", "bathtub", ...]
        ├── parseFloor()       → { floor, floor_preference }
        ├── parsePreferences() → ["quiet", "business", ...]
        └── parseSortBy()      → "price_asc" / "price_desc"
        │
        ▼
{ intent, entities, enrichedText, rawText }
```

### 4.3 Luồng tìm phòng (search_rooms tool)

```
searchRooms.invoke({ checkin, checkout, people, min_price, max_price })
        │
        ▼
SQL Query:
  - JOIN rooms + room_types + bed_types + amenities + room_images
  - Giá 3 tầng: COALESCE(room_prices ngày cụ thể, room_type_prices, base_price)
  - Lọc phòng trống: NOT EXISTS booking_rooms overlap
  - Lọc capacity >= people
  - HAVING final_price BETWEEN min_price AND max_price
  - ORDER BY final_price ASC LIMIT 10
        │
        ├── Có kết quả → trả về JSON array rooms
        └── Không có kết quả → fallback query (bỏ filter capacity, lấy 8 phòng active)
```

### 4.4 Luồng quản lý session

```
Mỗi request mang sessionId (tạo ngẫu nhiên ở FE)
        │
        ▼
getHistory(sessionId)  ← Redis hoặc RAM
        │
        ▼
Xử lý xong → saveHistory() + saveContext()
        │
        ▼
TTL: 2 giờ, giữ tối đa 20 messages
```

---

## 5. Các LangChain Tools

| Tool | Mô tả | Input chính |
|---|---|---|
| `search_rooms` | Tìm phòng trống theo tiêu chí | checkin, checkout, people, min/max_price |
| `get_room_price` | Lấy giá hiệu lực của 1 phòng (3-tier) | room_id |
| `get_booking` | Tra cứu đặt phòng | mã booking hoặc số điện thoại |
| `create_booking` | Tạo đơn đặt phòng mới | ho_ten, sdt, phong_id, checkin, checkout |

---

## 6. Hệ thống giá 3 tầng

```sql
COALESCE(
  room_prices (giá theo ngày cụ thể của phòng vật lý),
  room_type_prices (giá theo ngày của loại phòng),
  room_types.base_price (giá gốc mặc định)
)
```

---

## 7. Knowledge Base tĩnh (knowledge.js)

Xử lý ~20 nhóm câu hỏi thường gặp bằng regex pattern matching — **không cần gọi LLM**, trả lời ngay lập tức:

- Chào hỏi, giờ check-in/out
- Chính sách hủy phòng, trẻ em, thú cưng
- Thanh toán, hóa đơn VAT, đậu xe
- Tiện ích (hồ bơi, gym, spa, wifi)
- Quy trình đặt phòng, hỗ trợ sự cố

---

## 8. API Endpoint

```
POST /api/chatbot/message
Authorization: optional (optionalAuth middleware)

Request:
{
  "sessionId": "abc123xyz",
  "message": "Tìm phòng cho 2 người dưới 1 triệu"
}

Response:
{
  "success": true,
  "data": {
    "message": "Em tìm được 3 phòng phù hợp...",
    "rooms": [ { id, name, price, capacity, image, rating, ... } ]
  }
}
```

---

## 9. Frontend ChatWidget

- Floating button góc phải màn hình
- Hiển thị typing indicator (3 chấm bounce)
- Quick replies: "Xem phòng còn trống", "Chính sách lưu trú", "Giờ nhận / trả phòng", "Liên hệ lễ tân"
- Render RoomCard inline khi bot trả về `rooms[]` (tối đa 3 card)
- Mỗi card có ảnh, tên, giá, nút "Xem chi tiết" → navigate đến `/room/:id`
- SessionId tạo ngẫu nhiên mỗi lần mở tab, lưu trong React state

---

## 10. Biến môi trường

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
REDIS_URL=redis://localhost:6379
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=smart_hotel
```
