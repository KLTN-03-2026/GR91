/**
 * tools.js — LangChain Tools cho SmartHotel Chatbot
 * Đã sửa lỗi giá 0đ và hiển thị chính xác phòng vật lý
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import pool from "./db.js";
import { diffNights, isValidDateOnly, isValidDateRange } from "./date.js";

// ─── Helper: map DB row → room object (Bảo vệ giá > 0) ───────────────────────────
function mapRow(r) {
  // Ưu tiên lấy final_price (giá 3 tầng), nếu không có hoặc <= 0 thì lấy base_price
  let displayPrice = Number(r.final_price);
  
  if (!displayPrice || displayPrice <= 0) {
    displayPrice = Number(r.base_price);
  }
  
  // Lớp chặn cuối cùng: Nếu DB thiếu cả giá gốc, set mặc định để không hiện 0đ
  if (!displayPrice || displayPrice <= 0) {
    displayPrice = 500000; 
  }

  return {
    id:       r.room_id,
    name:     `${r.type_name} (Phòng ${r.room_number})`, // Hiển thị rõ số phòng vật lý
    price:    displayPrice,
    capacity: Number(r.capacity || 2),
    beds:     r.beds || "Giường tiêu chuẩn",
    image:    r.image || null,
    rating:   r.rating ? Number(r.rating) : 5,
    floor:    r.floor,
    room_number: r.room_number,
    amenities: r.amenities || "Đầy đủ tiện nghi",
    description: r.description || ""
  };
}

function joinNames(rows) {
  return rows.map((r) => r.name).filter(Boolean).join(", ");
}

export async function getHotelAmenitiesInfo() {
  const [rows] = await pool.execute(`
    SELECT name
    FROM amenities
    WHERE LOWER(name) REGEXP 'wifi|hồ bơi|pool|spa|gym|fitness|bữa sáng|breakfast|buffet|ai assistant'
    ORDER BY amenity_id
  `);

  const names = joinNames(rows);
  if (!names) {
    return "Hiện em chưa có dữ liệu tiện ích khách sạn trong hệ thống. Anh/chị có thể hỏi lễ tân để xác nhận chính xác hơn ạ.";
  }

  return `Các tiện ích chung của khách sạn hiện có: ${names}. Một số tiện ích có thể phụ thuộc thời điểm vận hành hoặc hạng phòng, nên nếu anh/chị cần dùng tiện ích cụ thể em có thể kiểm tra thêm theo loại phòng.`;
}

export async function getRoomAmenitiesInfo({ room_id, room_number, room_type } = {}) {
  const params = [];
  let where = "";

  if (room_id) {
    where = "WHERE r.room_id = ?";
    params.push(room_id);
  } else if (room_number) {
    where = "WHERE r.room_number = ?";
    params.push(room_number);
  } else if (room_type) {
    where = "WHERE rt.name LIKE ?";
    params.push(`%${room_type}%`);
  }

  if (!where) {
    const [rows] = await pool.execute(`
      SELECT DISTINCT a.amenity_id, a.name
      FROM amenities a
      JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
      WHERE LOWER(a.name) NOT REGEXP 'hồ bơi|pool|spa|gym|fitness|ai assistant'
      ORDER BY a.amenity_id
    `);
    const names = joinNames(rows);
    return names
      ? `Các tiện ích trong phòng thường có: ${names}. Nếu anh/chị muốn biết chính xác cho một phòng cụ thể, hãy gửi số phòng hoặc loại phòng giúp em.`
      : "Hiện em chưa có dữ liệu tiện ích trong phòng. Anh/chị gửi số phòng hoặc loại phòng để em kiểm tra kỹ hơn ạ.";
  }

  const [rows] = await pool.execute(`
    SELECT
      r.room_id,
      r.room_number,
      rt.name AS type_name,
      GROUP_CONCAT(DISTINCT a.name ORDER BY a.amenity_id SEPARATOR ', ') AS amenities
    FROM rooms r
    JOIN room_types rt ON r.type_id = rt.type_id
    LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
    LEFT JOIN amenities a ON rta.amenity_id = a.amenity_id
    ${where}
    GROUP BY r.room_id, r.room_number, rt.name
    ORDER BY r.room_id
    LIMIT 3
  `, params);

  if (rows.length === 0) {
    return "Em chưa tìm thấy phòng hoặc loại phòng đó trong hệ thống. Anh/chị gửi giúp em số phòng hoặc tên loại phòng chính xác hơn ạ.";
  }

  return rows
    .map((r) => {
      const names = r.amenities || "chưa có tiện ích được cấu hình";
      return `${r.type_name} (Phòng ${r.room_number}) có: ${names}.`;
    })
    .join("\n");
}

export async function searchRoomsByAmenity({ amenity } = {}) {
  const keyword = String(amenity || "").trim();
  if (!keyword) {
    return {
      text: "Anh/chị muốn tìm phòng theo tiện ích nào ạ? Ví dụ: bồn tắm, ban công, mini bar, wifi.",
      rooms: [],
    };
  }

  const targetDate = new Date().toISOString().split("T")[0];
  const [rows] = await pool.execute(`
    SELECT
      r.room_id, r.room_number, r.floor,
      rt.name AS type_name, rt.capacity, rt.base_price,
      rt.description,
      COALESCE(
        (SELECT price FROM room_prices WHERE room_id = r.room_id AND date = ? LIMIT 1),
        (SELECT price FROM room_type_prices WHERE type_id = rt.type_id AND date = ? LIMIT 1),
        rt.base_price
      ) AS final_price,
      (SELECT url FROM room_images WHERE room_id = r.room_id ORDER BY image_id LIMIT 1) AS image,
      (SELECT AVG(rating) FROM reviews WHERE room_type_id = rt.type_id AND status = 'VISIBLE') AS rating,
      (SELECT GROUP_CONCAT(name SEPARATOR ', ') FROM amenities a2
       JOIN room_type_amenities rta2 ON a2.amenity_id = rta2.amenity_id
       WHERE rta2.type_id = rt.type_id) AS amenities,
      (SELECT GROUP_CONCAT(name SEPARATOR ', ') FROM bed_types bt
       JOIN room_type_beds rtb ON bt.bed_id = rtb.bed_id
       WHERE rtb.type_id = rt.type_id) AS beds
    FROM rooms r
    JOIN room_types rt ON r.type_id = rt.type_id
    JOIN room_type_amenities rta ON rt.type_id = rta.type_id
    JOIN amenities a ON rta.amenity_id = a.amenity_id
    WHERE r.status = 'ACTIVE'
      AND LOWER(a.name) LIKE LOWER(?)
    GROUP BY r.room_id, r.room_number, r.floor, rt.name, rt.capacity, rt.base_price, rt.description
    ORDER BY final_price ASC
    LIMIT 10
  `, [targetDate, targetDate, `%${keyword}%`]);

  const rooms = rows.map(mapRow);
  if (rooms.length === 0) {
    return {
      text: `Em chưa tìm thấy phòng đang hoạt động có tiện ích "${keyword}". Anh/chị có thể thử tiện ích khác như ban công, mini bar, wifi hoặc bồn tắm.`,
      rooms: [],
    };
  }

  return {
    text: `Em tìm được ${rooms.length} phòng có tiện ích ${keyword}:`,
    rooms,
  };
}

// ─── Tool 1: search_rooms ─────────────────────────────────────────────────────
export const searchRooms = tool(
  async ({ checkin, checkout, people, min_price, max_price, room_type, floor, floor_preference, sort_by }) => {
    try {
      const hasValidRange = checkin && checkout && isValidDateRange(checkin, checkout);
      // Lấy giá theo ngày khách yêu cầu hoặc ngày hiện tại
      const targetDate = (checkin && isValidDateOnly(checkin)) ? checkin : new Date().toISOString().split('T')[0];
      const params = [targetDate, targetDate];

      // SQL lấy dữ liệu thô bao gồm giá 3 tầng
      let innerSql = `
        SELECT 
          r.room_id, r.room_number, r.floor,
          rt.name AS type_name, rt.capacity, rt.base_price,
          rt.description,
          COALESCE(
            (SELECT price FROM room_prices WHERE room_id = r.room_id AND date = ? LIMIT 1),
            (SELECT price FROM room_type_prices WHERE type_id = rt.type_id AND date = ? LIMIT 1),
            rt.base_price
          ) AS final_price,
          (SELECT url FROM room_images WHERE room_id = r.room_id ORDER BY image_id LIMIT 1) AS image,
          (SELECT AVG(rating) FROM reviews WHERE room_type_id = rt.type_id AND status = 'VISIBLE') AS rating,
          (SELECT GROUP_CONCAT(name SEPARATOR ', ') FROM amenities a 
           JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id 
           WHERE rta.type_id = rt.type_id) AS amenities,
          (SELECT GROUP_CONCAT(name SEPARATOR ', ') FROM bed_types bt 
           JOIN room_type_beds rtb ON bt.bed_id = rtb.bed_id 
           WHERE rtb.type_id = rt.type_id) AS beds
        FROM rooms r
        JOIN room_types rt ON r.type_id = rt.type_id
        WHERE r.status = 'ACTIVE'
      `;

      // Lọc phòng trống theo lịch đặt
      if (hasValidRange) {
        innerSql += ` AND NOT EXISTS (
          SELECT 1 FROM booking_rooms br
          JOIN bookings b ON br.booking_id = b.booking_id
          WHERE br.room_id = r.room_id AND b.status NOT IN ('CANCELLED')
          AND NOT (br.check_out <= ? OR br.check_in >= ?)
        )`;
        params.push(checkin, checkout);
      }

      if (people) {
        innerSql += " AND rt.capacity >= ?";
        params.push(people);
      }

      if (room_type) {
        innerSql += " AND (rt.name LIKE ? OR rt.description LIKE ?)";
        params.push(`%${room_type}%`, `%${room_type}%`);
      }

      if (floor) {
        innerSql += " AND r.floor = ?";
        params.push(floor);
      } else if (floor_preference === "high") {
        innerSql += " AND r.floor >= 3";
      } else if (floor_preference === "low") {
        innerSql += " AND r.floor <= 2";
      }

      // Wrap câu query để filter giá chính xác trên kết quả đã tính toán
      let sql = `SELECT * FROM (${innerSql}) AS room_data`;
      const paramsBeforePriceFilter = [...params];
      const whereParts = [];
      if (min_price) { whereParts.push("final_price >= ?"); params.push(min_price); }
      if (max_price) { whereParts.push("final_price <= ?"); params.push(max_price); }
      
      if (whereParts.length > 0) sql += " WHERE " + whereParts.join(" AND ");
      sql += sort_by === "price_desc" ? " ORDER BY final_price DESC LIMIT 10" : " ORDER BY final_price ASC LIMIT 10";

      const [rows] = await pool.execute(sql, params);

      if (rows.length === 0) {
        if (min_price || max_price) {
          const [nearestRows] = await pool.execute(
            `SELECT * FROM (${innerSql}) AS room_data ORDER BY final_price ASC LIMIT 3`,
            paramsBeforePriceFilter
          );
          if (nearestRows.length > 0) {
            return JSON.stringify({
              rooms: nearestRows.map(mapRow),
              match: "nearest",
              reason: "Không có phòng đúng ngân sách, trả về lựa chọn gần nhất.",
              criteria: { checkin, checkout, people, min_price, max_price, room_type, floor, floor_preference },
            });
          }
        }

        return JSON.stringify({
          rooms: [],
          reason: hasValidRange
            ? "Không có phòng khớp đầy đủ ngày ở và tiêu chí đã chọn."
            : "Không có phòng khớp đầy đủ tiêu chí đã chọn.",
          criteria: { checkin, checkout, people, min_price, max_price, room_type, floor, floor_preference },
        });
      }

      return JSON.stringify({ rooms: rows.map(mapRow), criteria: { checkin, checkout, people, min_price, max_price } });
    } catch (err) {
      console.error("[search_rooms] Lỗi:", err.message);
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "search_rooms",
    description: "Tìm phòng trống và giá thực tế theo số người, ngày và khoảng giá.",
    schema: z.object({
      checkin: z.string().optional().nullable().describe("YYYY-MM-DD"),
      checkout: z.string().optional().nullable().describe("YYYY-MM-DD"),
      people: z.number().optional().nullable(),
      min_price: z.number().optional().nullable(),
      max_price: z.number().optional().nullable(),
      room_type: z.string().optional().nullable(),
      floor: z.number().optional().nullable(),
      floor_preference: z.string().optional().nullable(),
      sort_by: z.string().optional().nullable(),
    }),
  }
);

// ─── Tool 2: get_room_price ───────────────────────────────────────────────────
export const getRoomPrice = tool(
  async ({ room_id, date }) => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const [rows] = await pool.execute(`
        SELECT
          r.room_id, r.room_number, rt.name AS type_name, rt.base_price,
          COALESCE(
            (SELECT price FROM room_prices WHERE room_id = r.room_id AND date = ? LIMIT 1),
            (SELECT price FROM room_type_prices WHERE type_id = r.type_id AND date = ? LIMIT 1),
            rt.base_price
          ) AS effective_price
        FROM rooms r
        JOIN room_types rt ON r.type_id = rt.type_id
        WHERE r.room_id = ?
      `, [targetDate, targetDate, room_id]);

      if (rows.length === 0) return JSON.stringify({ error: "Không tìm thấy phòng" });
      return JSON.stringify(rows[0]);
    } catch (err) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "get_room_price",
    description: "Lấy giá hiệu lực của một phòng tại ngày cụ thể.",
    schema: z.object({ 
      room_id: z.coerce.number(),
      date: z.string().optional()
    }),
  }
);

// ─── Tool 3: get_booking ──────────────────────────────────────────────────────
export const getBooking = tool(
  async ({ identifier }) => {
    try {
      const isShortNum = !isNaN(Number(identifier)) && identifier.length < 9;
      const [rows] = await pool.execute(`
        SELECT b.booking_id, b.status, b.total_price, b.paid_amount, b.remaining_amount,
               u.full_name, u.phone, b.created_at
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        WHERE ${isShortNum ? "b.booking_id = ?" : "u.phone LIKE ?"}
        ORDER BY b.created_at DESC LIMIT 3
      `, [isShortNum ? identifier : `%${identifier}%`]);

      if (rows.length === 0) return JSON.stringify({ error: "Không tìm thấy đặt phòng." });
      return JSON.stringify(rows);
    } catch (err) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "get_booking",
    description: "Tra cứu đặt phòng theo mã hoặc số điện thoại.",
    schema: z.object({ identifier: z.string() }),
  }
);

// ─── Tool 4: create_booking ───────────────────────────────────────────────────
export const createBooking = tool(
  async ({ ho_ten, sdt, phong_id, checkin, checkout }) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lấy giá 3 tầng chính xác cho ngày đặt
      const [phong] = await conn.execute(
        `SELECT rt.base_price,
          COALESCE(
            (SELECT price FROM room_prices WHERE room_id = r.room_id AND date = ? LIMIT 1),
            (SELECT price FROM room_type_prices WHERE type_id = r.type_id AND date = ? LIMIT 1),
            rt.base_price
          ) AS daily_price
         FROM rooms r JOIN room_types rt ON r.type_id = rt.type_id
         WHERE r.room_id = ? AND r.status = 'ACTIVE'`,
        [checkin, checkin, phong_id]
      );

      if (phong.length === 0) throw new Error("Phòng không khả dụng.");

      const pricePerNight = Number(phong[0].daily_price);
      const total = pricePerNight * diffNights(checkin, checkout);

      let uId;
      const [u] = await conn.execute("SELECT user_id FROM users WHERE phone = ?", [sdt]);
      if (u.length > 0) uId = u[0].user_id;
      else {
        const [newU] = await conn.execute("INSERT INTO users (full_name, phone) VALUES (?, ?)", [ho_ten, sdt]);
        uId = newU.insertId;
      }

      const [b] = await conn.execute(
        "INSERT INTO bookings (user_id, total_price, status, expires_at) VALUES (?, ?, 'PENDING', DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
        [uId, total]
      );

      await conn.execute(
        "INSERT INTO booking_rooms (booking_id, room_id, check_in, check_out, price) VALUES (?, ?, ?, ?, ?)",
        [b.insertId, phong_id, checkin, checkout, pricePerNight]
      );

      await conn.commit();
      return JSON.stringify({ success: true, message: `Đặt phòng thành công #${b.insertId}.` });
    } catch (err) {
      await conn.rollback();
      return JSON.stringify({ success: false, message: err.message });
    } finally {
      conn.release();
    }
  },
  {
    name: "create_booking",
    description: "Tạo đơn đặt phòng mới.",
    schema: z.object({
      ho_ten: z.string(),
      sdt: z.string(),
      phong_id: z.coerce.number(),
      checkin: z.string(),
      checkout: z.string(),
    }),
  }
);

// createBooking is intentionally not exposed to the LLM agent.
// Booking must go through the normal checkout flow so inventory locks,
// payment policy, expiry and audit logs stay consistent.
export const tools = [searchRooms, getRoomPrice, getBooking];
