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

// ─── Tool 1: search_rooms ─────────────────────────────────────────────────────
export const searchRooms = tool(
  async ({ checkin, checkout, people, min_price, max_price }) => {
    try {
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
      if (checkin && checkout) {
        innerSql += ` AND NOT EXISTS (
          SELECT 1 FROM booking_rooms br
          JOIN bookings b ON br.booking_id = b.booking_id
          WHERE br.room_id = r.room_id AND b.status != 'CANCELLED'
          AND NOT (br.check_out <= ? OR br.check_in >= ?)
        )`;
        params.push(checkin, checkout);
      }

      if (people) {
        innerSql += " AND rt.capacity >= ?";
        params.push(people);
      }

      // Wrap câu query để filter giá chính xác trên kết quả đã tính toán
      let sql = `SELECT * FROM (${innerSql}) AS room_data`;
      const whereParts = [];
      if (min_price) { whereParts.push("final_price >= ?"); params.push(min_price); }
      if (max_price) { whereParts.push("final_price <= ?"); params.push(max_price); }
      
      if (whereParts.length > 0) sql += " WHERE " + whereParts.join(" AND ");
      sql += " ORDER BY final_price ASC LIMIT 10";

      const [rows] = await pool.execute(sql, params);

      // Fallback nếu không tìm thấy phòng nào thỏa mãn filter
      if (rows.length === 0) {
        const [fallback] = await pool.execute(
          `SELECT r.room_id, r.room_number, rt.name as type_name, rt.base_price, rt.capacity 
           FROM rooms r JOIN room_types rt ON r.type_id = rt.type_id 
           WHERE r.status = 'ACTIVE' LIMIT 5`
        );
        return JSON.stringify(fallback.map(mapRow));
      }

      return JSON.stringify(rows.map(mapRow));
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

export const tools = [searchRooms, getRoomPrice, getBooking, createBooking];