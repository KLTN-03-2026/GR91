# Tài liệu Chatbot SmartHotel

## 1. Tổng quan

Chatbot SmartHotel là trợ lý AI tích hợp trực tiếp vào giao diện web, hỗ trợ khách hàng tìm phòng, tra cứu giá, hỏi tiện ích, kiểm tra đặt phòng và giải đáp chính sách khách sạn bằng tiếng Việt.

Chatbot hiện dùng pipeline hybrid:

- Regex / NLU xử lý nhanh các câu phổ biến.
- Context theo `sessionId` để nhớ tiêu chí hội thoại.
- SQL tools truy vấn dữ liệu thật từ MySQL.
- LangGraph ReAct Agent chỉ dùng cho các câu khó hoặc tra cứu cần tool.
- Knowledge base tĩnh trả lời nhanh các chính sách phổ biến.

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| LLM local | Ollama model `llama3.2:3b` tại `localhost:11434` |
| Agent framework | LangChain / LangGraph `createReactAgent` |
| Tool schema | Zod |
| Database | MySQL `mysql2/promise` |
| Session storage | Redis, fallback in-memory RAM, TTL 2 giờ |
| Backend | Express.js + TypeScript |
| Frontend | React + TypeScript `ChatWidget` |
| API client | `post()` helper trong `FE/src/lib/api.ts` |

---

## 3. Cấu trúc file

```text
BE/src/services/chatbot/
├── agent.js       - Điều phối chính: intent, NLU, context, routing, tool calls
├── tools.js       - SQL tools: tìm phòng, giá, booking, tiện ích
├── nlu.js         - Parse tiếng Việt thành intent + entities
├── knowledge.js   - FAQ/chính sách tĩnh
├── context.js     - Merge context hội thoại từ NLU
├── session.js     - Redis/RAM history + context
├── prompt.js      - System prompts cho LLM
├── date.js        - Xử lý ngày tháng
└── db.js          - Ollama + MySQL pool

BE/src/routes/
└── chatbot.ts     - POST /api/chatbot/message

FE/src/components/features/
└── ChatWidget.tsx - Floating chat UI + RoomCard

FE/src/lib/
└── api.ts         - chatbotApi.sendMessage()
```

---

## 4. Luồng tổng quát

```text
User nhập tin nhắn
        |
        v
ChatWidget.tsx
        |
        | POST /api/chatbot/message
        | { sessionId, message, context? }
        v
routes/chatbot.ts
        |
        | optionalAuth -> req.userId nếu có token
        | runAgent(message, { sessionId, context, userId })
        v
agent.js
        |
        | getHistory(sessionId)
        | getContext(sessionId)
        | analyzeInput(message)
        | updateContext(oldContext, nluResult)
        v
Routing theo intent / loại câu hỏi
        |
        +-- Tiện ích khách sạn / phòng -> SQL helper trong tools.js
        +-- Tìm phòng / hỏi giá -> search_rooms
        +-- Hỏi booking -> ReAct Agent + get_booking
        +-- Chính sách / FAQ -> knowledge.js
        +-- Khác -> ReAct Agent fallback
        |
        v
saveContext(sessionId)
saveHistory(sessionId)
        |
        v
Response:
{ success, data: { message, rooms } }
        |
        v
ChatWidget render text + RoomCard nếu có rooms[]
```

Điểm quan trọng: API response vẫn giữ định dạng cũ để không ảnh hưởng Frontend.

---

## 5. Luồng NLU và Context

### 5.1 NLU

`nlu.js` nhận text tiếng Việt và trích xuất:

| Entity | Ví dụ |
|---|---|
| `intent` | `search`, `alternative`, `booking_info`, `facility`, `policy` |
| `people` | "2 người", "cho 3 khách" |
| `children` | "1 bé 5 tuổi" |
| `checkin`, `checkout` | "mai 2 đêm", "từ 15/5 đến 18/5" |
| `room_type` | Family, Deluxe, Suite, Standard |
| `min_price`, `max_price` | "dưới 500k", "từ 700k đến 1tr5" |
| `amenities` | wifi, bathtub, balcony, breakfast |
| `floor`, `floor_preference` | "tầng 3", "tầng cao" |
| `sort_by` | `price_asc`, `price_desc` |

### 5.2 Context hội thoại

`context.js` merge entity mới vào context cũ theo `sessionId`.

Ví dụ:

```text
User: Phòng nào phù hợp với gia đình?
Context: { room_type: "Family" }

User: Có phần nào giá 500 không?
Context: { room_type: "Family", max_price: 500000 }

User: Loại khác giá 500
Context: { room_type: null, max_price: 500000 }
```

Các rule ngữ cảnh đã hỗ trợ:

- "loại khác", "phòng khác", "hạng khác" -> bỏ filter `room_type` cũ.
- "giá cao hơn nữa", "đắt hơn", "mắc hơn" -> đổi `max_price` cũ thành `min_price`, bỏ trần giá.
- "rẻ hơn", "thấp hơn" -> ưu tiên dưới mức giá đang nhớ.
- Các câu sau có thể bổ sung tiêu chí thay vì bắt đầu lại từ đầu.

---

## 6. Luồng tìm phòng / hỏi giá

### 6.1 Input

`agent.js` gọi:

```js
searchRooms.invoke({
  checkin,
  checkout,
  people,
  min_price,
  max_price,
  room_type,
  floor,
  floor_preference,
  sort_by
})
```

### 6.2 SQL logic

`search_rooms` truy vấn:

- `rooms`
- `room_types`
- `room_images`
- `room_type_amenities`
- `amenities`
- `room_type_beds`
- `bed_types`
- `reviews`
- `booking_rooms`
- `bookings`

Giá dùng hệ thống 3 tầng:

```sql
COALESCE(
  room_prices.price,
  room_type_prices.price,
  room_types.base_price
)
```

Lọc chính:

- Chỉ lấy `rooms.status = 'ACTIVE'`.
- Nếu có ngày ở, loại phòng đã có booking overlap sẽ bị loại.
- Nếu có số khách, lọc `room_types.capacity >= people`.
- Nếu có `room_type`, lọc theo tên/mô tả loại phòng.
- Nếu có tầng hoặc ưu tiên tầng, lọc theo `rooms.floor`.
- Nếu có giá, lọc theo `final_price`.
- Sắp xếp theo giá tăng/giảm tùy `sort_by`.

### 6.3 Fallback thông minh theo ngân sách

Nếu không có phòng đúng ngân sách nhưng vẫn có phòng khớp các tiêu chí khác, chatbot trả về các phòng gần nhất thay vì trả lời cụt.

Ví dụ:

```text
User: Cho tôi phòng dưới 500k
Bot: Em tìm được các phòng dưới 500.000đ...

User: Giá cao hơn nữa
Bot: Em tìm được các phòng từ 500.000đ...
```

---

## 7. Luồng hỏi tiện ích

Phần tiện ích hiện được xử lý trước FAQ và trước tìm phòng thường, để tránh trả lời chung chung.

### 7.1 Hỏi tiện ích khách sạn

Ví dụ:

- "Khách sạn có tiện ích gì?"
- "Khách sạn có wifi không?"
- "Có hồ bơi không?"
- "Có gym/spa không?"

Luồng:

```text
isAmenityQuestion()
        |
        v
wantsHotelAmenities()
        |
        v
getHotelAmenitiesInfo()
        |
        v
SELECT amenities theo nhóm tiện ích chung
        |
        v
Trả lời text, rooms = []
```

Dữ liệu lấy từ bảng `amenities`. Các tiện ích chung hiện nhận diện: Wifi, Hồ bơi, Spa, Phòng Gym, Breakfast/Buffet nếu có trong DB, AI Assistant.

### 7.2 Hỏi tiện ích trong phòng nói chung

Ví dụ:

- "Trong phòng có tiện ích gì?"
- "Tiện nghi trong phòng gồm gì?"

Luồng:

```text
isAmenityQuestion()
        |
        v
wantsRoomAmenities()
        |
        v
getRoomAmenitiesInfo()
        |
        v
SELECT DISTINCT amenities gắn với room_type_amenities
        |
        v
Trả lời danh sách tiện ích phòng thường có
```

Ví dụ response:

```text
Các tiện ích trong phòng thường có: Wifi, TV, Air Conditioner, Mini Bar, Balcony, Bồn tắm nằm.
Nếu anh/chị muốn biết chính xác cho một phòng cụ thể, hãy gửi số phòng hoặc loại phòng giúp em.
```

### 7.3 Hỏi tiện ích của một phòng cụ thể

Ví dụ:

- "Phòng 106 có tiện ích gì?"
- "Phòng 106 có gì?"

Luồng:

```text
extractRoomNumber("phòng 106") -> 106
        |
        v
getRoomAmenitiesInfo({ room_number: "106" })
        |
        v
JOIN rooms + room_types + room_type_amenities + amenities
        |
        v
Trả lời tiện ích đúng của phòng vật lý
```

Ví dụ response:

```text
Standard Double Room (Phòng 106) có: Wifi, TV, Air Conditioner.
```

### 7.4 Tìm phòng theo tiện ích

Ví dụ:

- "Phòng có bồn tắm nằm"
- "Hòng có Bồn tắm nằm" (có hỗ trợ typo thiếu chữ "p")
- "Phòng có ban công"
- "Phòng có mini bar"
- "Phòng có wifi"
- "Phòng có điều hòa"
- "Phòng có TV"

Luồng:

```text
isAmenityQuestion()
        |
        v
wantsRoomsWithAmenity()
        |
        v
extractAmenityKeyword()
        |
        v
searchRoomsByAmenity({ amenity })
        |
        v
JOIN rooms + room_types + room_type_amenities + amenities
        |
        v
Trả về { text, rooms }
        |
        v
Frontend render RoomCard
```

Ví dụ:

```text
User: hòng có Bồn tắm nằm
Bot: Em tìm được 4 phòng có tiện ích bồn tắm:
rooms: Deluxe Twin Room 202, Deluxe Twin Room 204, Suite Room 301, Suite Room 304
```

---

## 8. Luồng FAQ / chính sách

`knowledge.js` xử lý nhanh các nhóm câu hỏi phổ biến bằng regex:

- Chào hỏi, hướng dẫn.
- Giờ check-in/check-out.
- Chính sách hủy phòng, hoàn tiền.
- Trẻ em, thú cưng.
- Thanh toán, VAT, hóa đơn.
- Bãi đậu xe.
- Quy trình đặt phòng.
- Sự cố đặt phòng/thanh toán.

Các câu hỏi tiện ích đã được ưu tiên xử lý bằng DB trước khi rơi vào `knowledge.js`.

---

## 9. Các tool và helper chính

| Tool/helper | Mô tả | Output |
|---|---|---|
| `search_rooms` | Tìm phòng theo ngày, giá, số khách, loại phòng, tầng | `{ rooms, criteria }` |
| `get_room_price` | Lấy giá hiệu lực của một phòng theo ngày | JSON object |
| `get_booking` | Tra cứu booking theo mã hoặc SĐT | JSON array |
| `create_booking` | Tạo booking cơ bản qua tool cũ | JSON status |
| `getHotelAmenitiesInfo` | Trả lời tiện ích chung khách sạn từ DB | text |
| `getRoomAmenitiesInfo` | Trả lời tiện ích trong phòng hoặc phòng cụ thể | text |
| `searchRoomsByAmenity` | Tìm phòng có tiện ích cụ thể | `{ text, rooms }` |

---

## 10. API Endpoint

```http
POST /api/chatbot/message
Authorization: optional
```

Request:

```json
{
  "sessionId": "abc123xyz",
  "message": "Tìm phòng cho 2 người dưới 1 triệu",
  "context": {}
}
```

Response:

```json
{
  "success": true,
  "data": {
    "message": "Em tìm được 3 phòng phù hợp...",
    "rooms": [
      {
        "id": 106,
        "name": "Standard Double Room (Phòng 106)",
        "price": 500000,
        "capacity": 2,
        "image": "...",
        "rating": 5,
        "amenities": "Wifi, TV, Air Conditioner"
      }
    ]
  }
}
```

---

## 11. Frontend ChatWidget

- Floating chat button ở góc phải.
- Gửi message qua `chatbotApi.sendMessage(sessionId, message)`.
- Hiển thị typing indicator.
- Quick replies:
  - "Xem phòng còn trống"
  - "Chính sách lưu trú"
  - "Giờ nhận / trả phòng"
  - "Liên hệ lễ tân"
- Render tối đa 3 `RoomCard` inline nếu response có `rooms[]`.
- Nút "Xem chi tiết" điều hướng đến `/room/:id`.
- `sessionId` hiện tạo trong React state cho mỗi tab.

---

## 12. Ví dụ hội thoại đã hỗ trợ

### 12.1 Tìm phòng gia đình rồi đổi tiêu chí

```text
User: Phòng nào phù hợp với gia đình?
Bot: Em tìm được các phòng Family...

User: Có phần nào giá 500 không?
Bot: Không có phòng Family dưới 500.000đ, gợi ý nới tiêu chí...

User: Loại khác giá 500
Bot: Em tìm phòng mọi loại dưới 500.000đ...
```

### 12.2 Tăng ngân sách theo ngữ cảnh

```text
User: Cho tôi xem các phòng giá 500
Bot: Em tìm được phòng dưới 500.000đ...

User: Giá cao hơn nữa
Bot: Em tìm được phòng từ 500.000đ...
```

### 12.3 Tìm phòng theo tiện ích

```text
User: hòng có Bồn tắm nằm
Bot: Em tìm được 4 phòng có tiện ích bồn tắm:
     Deluxe Twin Room 202, Deluxe Twin Room 204, Suite Room 301, Suite Room 304
```

### 12.4 Hỏi tiện ích trong phòng

```text
User: Trong phòng có tiện ích gì?
Bot: Các tiện ích trong phòng thường có: Wifi, TV, Air Conditioner, Mini Bar, Balcony, Bồn tắm nằm...
```

### 12.5 Hỏi tiện ích khách sạn

```text
User: Khách sạn có tiện ích gì?
Bot: Các tiện ích chung của khách sạn hiện có: Wifi, Hồ bơi, Spa, Phòng Gym, AI Assistant...
```

---

## 13. Biến môi trường

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
