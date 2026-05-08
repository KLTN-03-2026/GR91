import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "../../db/client.js";
import { retrievePolicy } from "./rag.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapRow(r: any) {
  let displayPrice = Number(r.final_price);
  if (!displayPrice || displayPrice <= 0) displayPrice = Number(r.base_price);
  if (!displayPrice || displayPrice <= 0) displayPrice = 500000;
  return {
    id: r.room_id,
    name: `${r.type_name} (Phòng ${r.room_number})`,
    price: displayPrice,
    capacity: Number(r.capacity || 2),
    beds: r.beds || "Giường tiêu chuẩn",
    image: r.image || null,
    rating: r.rating ? Number(r.rating) : 5,
    floor: r.floor,
    room_number: r.room_number,
    amenities: r.amenities || "Đầy đủ tiện nghi",
    description: r.description || "",
    area_sqm: r.area_sqm || null,
  };
}

// Parse string or number → number (Groq may send "4" instead of 4)
function toNum(v: any): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

// Helper: lấy một room_id đại diện cho mỗi type_id (để FE navigate đến /room/:id)
async function getRepresentativeRoomId(typeId: number): Promise<number | null> {
  const [rows] = await pool.execute<any[]>(
    `SELECT room_id FROM rooms WHERE type_id = ? AND status = 'ACTIVE' ORDER BY room_id LIMIT 1`,
    [typeId]
  );
  return rows.length > 0 ? rows[0].room_id : null;
}

// Normalize type-level rows → FE-compatible format (giữ nguyên description/amenities/beds cho AI)
async function normalizeTypeRow(r: any) {
  const roomId = await getRepresentativeRoomId(r.type_id);
  return {
    id: roomId,
    type_id: r.type_id,
    name: r.type_name || r.name,
    price: Number(r.base_price) || Number(r.final_price) || 0,
    capacity: Number(r.capacity || 2),
    area_sqm: r.area_sqm || null,
    image: r.image || null,
    rating: r.avg_rating ? Number(r.avg_rating) : null,
    // Giữ nguyên text fields để AI có đủ context so sánh/tư vấn
    amenities: r.amenities || "",
    beds: r.beds || "",
    description: r.description || "",
    booking_count: r.booking_count || null,
    review_count: r.review_count || null,
    matched_amenities: r.matched_amenities || null,
  };
}

// ─── search_rooms ─────────────────────────────────────────────────────────────

export const searchRooms = tool(
  async (params) => {
    try {
      const people    = toNum(params.people);
      const min_price = toNum(params.min_price);
      const max_price = toNum(params.max_price);
      const floor     = toNum(params.floor);
      const room_type = params.room_type || undefined;
      const sort_by   = params.sort_by || "price_asc";

      const today = new Date().toISOString().split("T")[0];
      const sqlParams: any[] = [today, today];

      let innerSql = `
        SELECT
          r.room_id, r.room_number, r.floor,
          rt.name AS type_name, rt.capacity, rt.base_price, rt.area_sqm,
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

      if (people)    { innerSql += " AND rt.capacity >= ?";                              sqlParams.push(people); }
      if (floor)     { innerSql += " AND r.floor = ?";                                   sqlParams.push(floor); }
      if (room_type) { innerSql += " AND (rt.name LIKE ? OR rt.description LIKE ?)";     sqlParams.push(`%${room_type}%`, `%${room_type}%`); }

      let sql = `SELECT * FROM (${innerSql}) AS room_data`;
      const whereParts: string[] = [];
      if (min_price) { whereParts.push("final_price >= ?"); sqlParams.push(min_price); }
      if (max_price) { whereParts.push("final_price <= ?"); sqlParams.push(max_price); }
      if (whereParts.length > 0) sql += " WHERE " + whereParts.join(" AND ");

      const orderMap: Record<string, string> = {
        price_asc:  "final_price ASC",
        price_desc: "final_price DESC",
        rating:     "rating DESC",
      };
      sql += ` ORDER BY ${orderMap[sort_by] ?? "final_price ASC"} LIMIT 5`;

      const [rows] = await pool.execute<any[]>(sql, sqlParams);

      // Fallback 2 bước khi không tìm thấy phòng
      if (rows.length === 0) {
        // Bước 1: Bỏ filter giá, giữ tầng + người + loại phòng
        const baseInnerParams = sqlParams.slice(0, sqlParams.length - (
          (min_price ? 1 : 0) + (max_price ? 1 : 0)
        ));
        const step1Sql = `SELECT * FROM (${innerSql}) AS room_data ORDER BY final_price ASC LIMIT 3`;
        const [step1Rows] = await pool.execute<any[]>(step1Sql, baseInnerParams);

        if (step1Rows.length > 0) {
          return JSON.stringify({
            nearest_match: true,
            fallback_reason: "price",
            message: "Không có phòng đúng mức giá, gợi ý phòng gần nhất.",
            rooms: step1Rows.map(mapRow),
          });
        }

        // Bước 2: Bỏ luôn filter tầng, chỉ giữ người + loại phòng
        const noFloorParams: any[] = [today, today];
        let noFloorSql = `
          SELECT r.room_id, r.room_number, r.floor,
            rt.name AS type_name, rt.capacity, rt.base_price, rt.area_sqm, rt.description,
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
          FROM rooms r JOIN room_types rt ON r.type_id = rt.type_id
          WHERE r.status = 'ACTIVE'
        `;
        if (people)    { noFloorSql += " AND rt.capacity >= ?"; noFloorParams.push(people); }
        if (room_type) { noFloorSql += " AND (rt.name LIKE ? OR rt.description LIKE ?)"; noFloorParams.push(`%${room_type}%`, `%${room_type}%`); }
        noFloorSql += " ORDER BY final_price ASC LIMIT 3";

        const [step2Rows] = await pool.execute<any[]>(noFloorSql, noFloorParams);
        return JSON.stringify({
          nearest_match: true,
          fallback_reason: "floor_and_price",
          message: "Không có phòng đúng tầng và giá yêu cầu, gợi ý phòng tương tự.",
          rooms: step2Rows.map(mapRow),
        });
      }

      return JSON.stringify({ nearest_match: false, rooms: rows.map(mapRow) });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "search_rooms",
    description: "Tìm kiếm phòng khả dụng theo số người, tầng, ngân sách và sắp xếp kết quả.",
    schema: z.object({
      people:    z.string().optional().nullable().describe("Số lượng khách (ví dụ: '2')"),
      floor:     z.string().optional().nullable().describe("Số tầng muốn ở (ví dụ: '2')"),
      min_price: z.string().optional().nullable().describe("Giá thấp nhất (VND)"),
      max_price: z.string().optional().nullable().describe("Giá cao nhất (VND)"),
      room_type: z.string().optional().nullable().describe("Loại phòng (Family, Double, Single, Deluxe...)"),
      sort_by:   z.string().optional().nullable().describe("Sắp xếp: 'price_asc' | 'price_desc' | 'rating'"),
    }),
  }
);

// ─── get_booking ──────────────────────────────────────────────────────────────

export const getBooking = tool(
  async ({ identifier }) => {
    try {
      const isShortNum = !isNaN(Number(identifier)) && identifier.length < 9;
      const [rows] = await pool.execute<any[]>(`
        SELECT b.booking_id, b.status, b.total_price, b.paid_amount, b.remaining_amount,
               u.full_name, u.phone, b.created_at
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        WHERE ${isShortNum ? "b.booking_id = ?" : "u.phone LIKE ?"}
        ORDER BY b.created_at DESC LIMIT 3
      `, [isShortNum ? identifier : `%${identifier}%`]);

      if (rows.length === 0) return JSON.stringify({ error: "Không tìm thấy đặt phòng." });
      return JSON.stringify(rows);
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "get_booking",
    description: "Tra cứu thông tin đặt phòng theo mã booking hoặc số điện thoại.",
    schema: z.object({
      identifier: z.string().describe("Mã booking (ID) hoặc Số điện thoại"),
    }),
  }
);

// ─── search_hotel_policy ──────────────────────────────────────────────────────

export const searchHotelPolicy = tool(
  async ({ query }) => {
    try {
      return await retrievePolicy(query);
    } catch (err: any) {
      return "Không thể tra cứu chính sách do lỗi hệ thống.";
    }
  },
  {
    name: "search_hotel_policy",
    description: "Tra cứu chính sách khách sạn: giờ check-in/out, huỷ phòng, trẻ em, bữa sáng.",
    schema: z.object({
      query: z.string().describe("Câu hỏi về chính sách"),
    }),
  }
);

// ─── update_search_context ────────────────────────────────────────────────────

export const updateSearchContext = tool(
  async (params) => {
    const normalized = {
      ...params,
      people:    toNum(params.people)    ?? null,
      floor:     toNum(params.floor)     ?? null,
      min_price: toNum(params.min_price) ?? null,
      max_price: toNum(params.max_price) ?? null,
    };
    return JSON.stringify({ success: true, updatedState: normalized });
  },
  {
    name: "update_search_context",
    description: "Cập nhật tiêu chí tìm kiếm khi khách thay đổi yêu cầu. Truyền null để xoá tiêu chí.",
    schema: z.object({
      people:    z.string().optional().nullable().describe("Số lượng khách"),
      floor:     z.string().optional().nullable().describe("Số tầng"),
      min_price: z.string().optional().nullable().describe("Giá thấp nhất (VND)"),
      max_price: z.string().optional().nullable().describe("Giá cao nhất (VND)"),
      room_type: z.string().optional().nullable().describe("Loại phòng. Null nếu loại nào cũng được."),
      sort_by:   z.string().optional().nullable().describe("Sắp xếp: price_asc | price_desc | rating"),
    }),
  }
);

// ─── get_trending_rooms ───────────────────────────────────────────────────────
// Social proof: gợi ý phòng phổ biến hoặc được đánh giá cao nhất

export const getTrendingRooms = tool(
  async ({ criteria }) => {
    try {
      let sql: string;
      let label: string;

      if (criteria === "top_rated") {
        label = "được đánh giá cao nhất";
        sql = `
          SELECT rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.area_sqm,
                 ROUND(AVG(rv.rating), 1) AS avg_rating, COUNT(rv.review_id) AS review_count,
                 (SELECT url FROM room_images ri JOIN rooms r2 ON ri.room_id = r2.room_id
                  WHERE r2.type_id = rt.type_id ORDER BY ri.image_id LIMIT 1) AS image,
                 (SELECT GROUP_CONCAT(a.name SEPARATOR ', ') FROM amenities a
                  JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
                  WHERE rta.type_id = rt.type_id) AS amenities
          FROM room_types rt
          JOIN reviews rv ON rv.room_type_id = rt.type_id AND rv.status = 'VISIBLE'
          GROUP BY rt.type_id
          HAVING review_count >= 1
          ORDER BY avg_rating DESC, review_count DESC
          LIMIT 4
        `;
      } else {
        // popular: dựa trên số lượt đặt
        label = "được đặt nhiều nhất";
        sql = `
          SELECT rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.area_sqm,
                 COUNT(br.booking_room_id) AS booking_count,
                 ROUND(AVG(rv.rating), 1) AS avg_rating,
                 (SELECT url FROM room_images ri JOIN rooms r2 ON ri.room_id = r2.room_id
                  WHERE r2.type_id = rt.type_id ORDER BY ri.image_id LIMIT 1) AS image,
                 (SELECT GROUP_CONCAT(a.name SEPARATOR ', ') FROM amenities a
                  JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
                  WHERE rta.type_id = rt.type_id) AS amenities
          FROM room_types rt
          JOIN rooms r ON r.type_id = rt.type_id
          JOIN booking_rooms br ON br.room_id = r.room_id
          JOIN bookings b ON b.booking_id = br.booking_id AND b.status != 'CANCELLED'
          LEFT JOIN reviews rv ON rv.room_type_id = rt.type_id AND rv.status = 'VISIBLE'
          GROUP BY rt.type_id
          ORDER BY booking_count DESC
          LIMIT 4
        `;
      }

      const [rows] = await pool.execute<any[]>(sql);
      const normalized = await Promise.all(rows.map(normalizeTypeRow));
      return JSON.stringify({ label, results: normalized });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "get_trending_rooms",
    description: "Gợi ý phòng theo xu hướng: phổ biến nhất (popular) hoặc được đánh giá cao nhất (top_rated). Dùng khi khách không có yêu cầu cụ thể.",
    schema: z.object({
      criteria: z.string().describe("'popular' (đặt nhiều nhất) hoặc 'top_rated' (đánh giá cao nhất)"),
    }),
  }
);

// ─── get_room_type_comparison ─────────────────────────────────────────────────
// So sánh 2-3 loại phòng khi khách đang phân vân

export const getRoomTypeComparison = tool(
  async ({ type_names }) => {
    try {
      if (!type_names || type_names.length < 2) {
        return JSON.stringify({ error: "Cần ít nhất 2 loại phòng để so sánh." });
      }

      const placeholders = type_names.map(() => "?").join(", ");
      const [rows] = await pool.execute<any[]>(`
        SELECT
          rt.type_id, rt.name, rt.base_price, rt.capacity, rt.area_sqm, rt.description,
          ROUND((SELECT AVG(rating) FROM reviews WHERE room_type_id = rt.type_id AND status = 'VISIBLE'), 1) AS avg_rating,
          (SELECT COUNT(*) FROM reviews WHERE room_type_id = rt.type_id AND status = 'VISIBLE') AS review_count,
          (SELECT GROUP_CONCAT(a.name SEPARATOR ', ') FROM amenities a
           JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
           WHERE rta.type_id = rt.type_id) AS amenities,
          (SELECT GROUP_CONCAT(bt.name SEPARATOR ', ') FROM bed_types bt
           JOIN room_type_beds rtb ON bt.bed_id = rtb.bed_id
           WHERE rtb.type_id = rt.type_id) AS beds,
          (SELECT url FROM room_images ri JOIN rooms r ON ri.room_id = r.room_id
           WHERE r.type_id = rt.type_id ORDER BY ri.image_id LIMIT 1) AS image
        FROM room_types rt
        WHERE rt.name IN (${placeholders})
      `, type_names);

      if (rows.length === 0) return JSON.stringify({ error: "Không tìm thấy loại phòng nào khớp." });
      const normalized = await Promise.all(rows.map(normalizeTypeRow));
      return JSON.stringify({ comparison: normalized });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "get_room_type_comparison",
    description: "So sánh chi tiết 2-3 loại phòng (giá, diện tích, tiện nghi, đánh giá) khi khách đang phân vân giữa các lựa chọn.",
    schema: z.object({
      type_names: z.array(z.string()).describe("Danh sách tên loại phòng cần so sánh, ví dụ: ['Deluxe', 'Suite']"),
    }),
  }
);

// ─── search_rooms_by_amenities ────────────────────────────────────────────────
// Tìm phòng theo tiện nghi cụ thể (ban công, bồn tắm, view biển...)

export const searchRoomsByAmenities = tool(
  async ({ tags }) => {
    try {
      if (!tags || tags.length === 0) {
        return JSON.stringify({ error: "Cần ít nhất 1 tiện nghi để tìm kiếm." });
      }

      // Tìm type_id có các amenity được yêu cầu
      const likeClauses = tags.map(() => "a.name LIKE ?").join(" OR ");
      const likeParams = tags.map((t: string) => `%${t}%`);

      const [rows] = await pool.execute<any[]>(`
        SELECT
          rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.area_sqm,
          rt.description,
          ROUND((SELECT AVG(rating) FROM reviews WHERE room_type_id = rt.type_id AND status = 'VISIBLE'), 1) AS avg_rating,
          (SELECT GROUP_CONCAT(a2.name SEPARATOR ', ') FROM amenities a2
           JOIN room_type_amenities rta2 ON a2.amenity_id = rta2.amenity_id
           WHERE rta2.type_id = rt.type_id) AS amenities,
          (SELECT url FROM room_images ri JOIN rooms r ON ri.room_id = r.room_id
           WHERE r.type_id = rt.type_id ORDER BY ri.image_id LIMIT 1) AS image,
          COUNT(DISTINCT a.amenity_id) AS matched_count
        FROM room_types rt
        JOIN room_type_amenities rta ON rta.type_id = rt.type_id
        JOIN amenities a ON a.amenity_id = rta.amenity_id AND (${likeClauses})
        GROUP BY rt.type_id
        ORDER BY matched_count DESC
        LIMIT 5
      `, likeParams);

      if (rows.length === 0) {
        return JSON.stringify({ message: "Không tìm thấy phòng có tiện nghi yêu cầu.", rooms: [] });
      }
      const normalized = await Promise.all(rows.map(normalizeTypeRow));
      return JSON.stringify({ rooms: normalized });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "search_rooms_by_amenities",
    description: "Tìm phòng theo tiện nghi cụ thể mà khách yêu cầu. Dùng khi khách nói 'phòng có ban công', 'có bồn tắm', 'view đẹp'...",
    schema: z.object({
      tags: z.array(z.string()).describe("Danh sách tiện nghi cần có, ví dụ: ['ban công', 'bồn tắm', 'view biển']"),
    }),
  }
);

// ─── recommend_by_persona ─────────────────────────────────────────────────────
// Gợi ý phòng theo chân dung khách hàng

export const recommendByPersona = tool(
  async ({ persona }) => {
    try {
      type PersonaConfig = {
        label: string;
        amenity_keywords: string[];
        prefer_low_floor: boolean;
        min_capacity: number;
        sort: string;
      };

      const personaMap: Record<string, PersonaConfig> = {
        couple: {
          label: "cặp đôi",
          amenity_keywords: ["bồn tắm", "view", "ban công"],
          prefer_low_floor: false,
          min_capacity: 2,
          sort: "rating DESC",
        },
        family: {
          label: "gia đình có trẻ nhỏ",
          amenity_keywords: ["thảm", "ban công"],
          prefer_low_floor: false,
          min_capacity: 3,
          sort: "capacity DESC",
        },
        business: {
          label: "khách công tác",
          amenity_keywords: ["bàn làm việc", "wifi", "máy in"],
          prefer_low_floor: false,
          min_capacity: 1,
          sort: "final_price ASC",
        },
        elderly: {
          label: "người cao tuổi",
          amenity_keywords: ["thang máy", "tay vịn"],
          prefer_low_floor: true,
          min_capacity: 1,
          sort: "final_price ASC",
        },
      };

      const config = personaMap[persona] ?? personaMap["couple"];
      const today = new Date().toISOString().split("T")[0];

      const likeClauses = config.amenity_keywords.map(() => "a.name LIKE ?").join(" OR ");
      const likeParams  = config.amenity_keywords.map(k => `%${k}%`);

      let sql = `
        SELECT
          rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.area_sqm,
          COALESCE(
            (SELECT price FROM room_type_prices WHERE type_id = rt.type_id AND date = ? LIMIT 1),
            rt.base_price
          ) AS final_price,
          ROUND((SELECT AVG(rating) FROM reviews WHERE room_type_id = rt.type_id AND status = 'VISIBLE'), 1) AS avg_rating,
          (SELECT GROUP_CONCAT(a2.name SEPARATOR ', ') FROM amenities a2
           JOIN room_type_amenities rta2 ON a2.amenity_id = rta2.amenity_id
           WHERE rta2.type_id = rt.type_id) AS amenities,
          (SELECT url FROM room_images ri JOIN rooms r ON ri.room_id = r.room_id
           WHERE r.type_id = rt.type_id ORDER BY ri.image_id LIMIT 1) AS image,
          COUNT(DISTINCT a.amenity_id) AS matched_amenities
        FROM room_types rt
        LEFT JOIN room_type_amenities rta ON rta.type_id = rt.type_id
        LEFT JOIN amenities a ON a.amenity_id = rta.amenity_id AND (${likeClauses})
        WHERE rt.capacity >= ?
      `;
      const sqlParams: any[] = [today, ...likeParams, config.min_capacity];

      if (config.prefer_low_floor) {
        sql += ` AND EXISTS (SELECT 1 FROM rooms r2 WHERE r2.type_id = rt.type_id AND r2.floor <= 3 AND r2.status = 'ACTIVE')`;
      }

      sql += ` GROUP BY rt.type_id ORDER BY matched_amenities DESC, ${config.sort} LIMIT 4`;

      const [rows] = await pool.execute<any[]>(sql, sqlParams);
      const normalized = await Promise.all(rows.map(normalizeTypeRow));
      return JSON.stringify({ persona: config.label, recommendations: normalized });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
  {
    name: "recommend_by_persona",
    description: "Gợi ý phòng phù hợp theo đối tượng khách: 'couple' (cặp đôi), 'family' (gia đình), 'business' (công tác), 'elderly' (người cao tuổi).",
    schema: z.object({
      persona: z.string().describe("Đối tượng khách: 'couple' | 'family' | 'business' | 'elderly'"),
    }),
  }
);

// ─── Export ───────────────────────────────────────────────────────────────────

export const tools = [
  searchRooms,
  getBooking,
  searchHotelPolicy,
  updateSearchContext,
  getTrendingRooms,
  getRoomTypeComparison,
  searchRoomsByAmenities,
  recommendByPersona,
];
