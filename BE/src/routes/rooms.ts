import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, optionalAuth, AuthRequest } from '../middleware/auth.js';

export const roomRouter = Router();

// Wrap async route để tự động forward error đến global handler
const h = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: any, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

function formatDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
}

function buildUnavailableRanges(rows: Array<{ date: string; status: string }>) {
  const blocked = rows
    .filter((row) => ['BOOKED', 'PENDING', 'BLOCKED'].includes(row.status))
    .sort((a, b) => a.date.localeCompare(b.date));

  const ranges: Array<{ check_in: string; check_out: string; status: string }> = [];

  for (const row of blocked) {
    const last = ranges[ranges.length - 1];
    if (!last || last.status !== row.status) {
      ranges.push({
        check_in: row.date,
        check_out: row.date,
        status: row.status,
      });
      continue;
    }

    const expectedNext = new Date(`${last.check_out}T00:00:00`);
    expectedNext.setDate(expectedNext.getDate() + 1);
    const nextDate = expectedNext.toISOString().split('T')[0];

    if (nextDate === row.date) {
      last.check_out = row.date;
      continue;
    }

    ranges.push({
      check_in: row.date,
      check_out: row.date,
      status: row.status,
    });
  }

  return ranges.map((range) => {
    const exclusive = new Date(`${range.check_out}T00:00:00`);
    exclusive.setDate(exclusive.getDate() + 1);
    return {
      check_in: range.check_in,
      check_out: exclusive.toISOString().split('T')[0],
      status: range.status,
    };
  });
}

// ── STATIC / SPECIFIC paths first (must be before /:type_id) ─────────────────

// PATCH /api/rooms/units/:room_id
roomRouter.patch('/units/:room_id', requireAuth, requireAdmin, h(async (req: AuthRequest, res: Response) => {
  const { room_number, floor, status, room_note } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `UPDATE rooms SET
        room_number = COALESCE(?, room_number),
        floor       = COALESCE(?, floor),
        status      = COALESCE(?, status),
        room_note   = COALESCE(?, room_note)
       WHERE room_id = ?`,
      [room_number ?? null, floor ?? null, status ?? null, room_note ?? null, req.params.room_id]
    );
    res.json({ success: true });
  } finally { conn.release(); }
}));

// DELETE /api/rooms/units/:room_id
roomRouter.delete('/units/:room_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM rooms WHERE room_id = ?', [req.params.room_id]);
    res.json({ success: true });
  } finally { conn.release(); }
});

// GET /api/rooms/units/:room_id/detail — thông tin đầy đủ 1 phòng kèm type + beds
roomRouter.get('/units/:room_id/detail', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT r.room_id, r.room_number, r.floor, r.status, r.room_note,
             rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity,
             rt.area_sqm, rc.name AS category_name,
             MAX(rp.price) AS override_price,
             GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_categories rc  ON rt.category_id = rc.category_id
      LEFT JOIN room_prices rp      ON rp.room_id = r.room_id AND rp.date = CURDATE()
      LEFT JOIN room_type_beds rtb  ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt        ON rtb.bed_id = bt.bed_id
      WHERE r.room_id = ?
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.type_id, rt.name, rt.base_price, rt.capacity, rt.area_sqm, rc.name
    `, [req.params.room_id]) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    const r = rows[0];
    res.json({
      ...r,
      override_price: r.override_price ?? null,
      effective_price: r.override_price ?? r.base_price,
      beds: r.beds ? r.beds.split(',').map((b: string) => {
        const [name, qty] = b.split(':');
        return { name, quantity: Number(qty) };
      }) : [],
    });
  } finally { conn.release(); }
});

// POST /api/rooms/units/:room_id/retype — tạo loại phòng mới hoặc gán loại có sẵn (Smart Logic)
roomRouter.post('/units/:room_id/retype', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, base_price, capacity, category_id, area_sqm, bed_id, bed_quantity } = req.body;
  if (!base_price) return res.status(400).json({ error: 'Thiếu giá phòng' });
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Tìm xem đã có Loại phòng nào khớp hoàn toàn cấu hình này chưa
    // Cấu hình khớp = cùng base_price, capacity, category_id, area_sqm
    // Và quan trọng nhất: Cùng loại giường & số lượng giường
    let targetTypeId: number | null = null;

    const [existingTypes] = await conn.execute(`
      SELECT rt.type_id 
      FROM room_types rt
      LEFT JOIN room_type_beds rtb ON rt.type_id = rtb.type_id
      WHERE rt.base_price = ? 
        AND rt.capacity = ? 
        AND COALESCE(rt.category_id, 0) = COALESCE(?, 0)
        AND COALESCE(rt.area_sqm, 0)   = COALESCE(?, 0)
        AND COALESCE(rtb.bed_id, 0)    = COALESCE(?, 0)
        AND COALESCE(rtb.quantity, 0)  = COALESCE(?, 0)
      LIMIT 1
    `, [
      Number(base_price), 
      capacity ?? 2, 
      category_id ?? 0, 
      area_sqm ?? 0, 
      bed_id ?? 0, 
      bed_quantity ?? 0
    ]) as any[];

    if (existingTypes.length > 0) {
      targetTypeId = existingTypes[0].type_id;
    } else {
      // 2. Nếu không tìm thấy, tạo room_type mới
      const [typeResult] = await conn.execute(
        'INSERT INTO room_types (name, base_price, capacity, category_id, area_sqm) VALUES (?,?,?,?,?)',
        [name || 'Custom Type', Number(base_price), capacity ?? 2, category_id ?? null, area_sqm ?? null]
      ) as any[];
      targetTypeId = (typeResult as any).insertId;

      // 2.1 Gán giường cho type mới
      if (bed_id) {
        await conn.execute(
          'INSERT INTO room_type_beds (type_id, bed_id, quantity) VALUES (?,?,?)',
          [targetTypeId, Number(bed_id), Number(bed_quantity ?? 1)]
        );
      }
    }

    // 3. Gán targetTypeId cho phòng
    await conn.execute('UPDATE rooms SET type_id = ? WHERE room_id = ?', [targetTypeId, req.params.room_id]);

    await conn.commit();
    res.status(201).json({ type_id: targetTypeId, reused: existingTypes.length > 0 });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
});

// PATCH /api/rooms/units/:room_id/type — đổi loại phòng hiện có cho phòng
roomRouter.patch('/units/:room_id/type', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { type_id } = req.body;
  if (!type_id) return res.status(400).json({ error: 'Thiếu type_id' });
  const conn = await pool.getConnection();
  try {
    await conn.execute('UPDATE rooms SET type_id = ? WHERE room_id = ?', [Number(type_id), req.params.room_id]);
    res.json({ success: true });
  } finally { conn.release(); }
});

// GET /api/rooms/units/:room_id/price — giá hôm nay (3-tier: room_price > type_price > base)
roomRouter.get('/units/:room_id/price', optionalAuth, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT rt.base_price,
             rtp.price  AS type_price,
             rp.price   AS room_price,
             COALESCE(rp.price, rtp.price, rt.base_price) AS effective_price
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_type_prices rtp ON rtp.type_id = rt.type_id AND rtp.date = CURDATE()
      LEFT JOIN room_prices rp       ON rp.room_id = r.room_id    AND rp.date = CURDATE()
      WHERE r.room_id = ?
    `, [req.params.room_id]) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    res.json({
      base_price:      rows[0].base_price,
      type_price:      rows[0].type_price  ?? null,
      room_price:      rows[0].room_price  ?? null,
      effective_price: rows[0].effective_price,
    });
  } finally { conn.release(); }
});

// GET /api/rooms/units/:room_id/price-range?check_in=&check_out=
// Trả về bảng giá từng ngày (3-tier) trong khoảng - SINGLE JOIN, không loop
roomRouter.get('/units/:room_id/price-range', optionalAuth, async (req: AuthRequest, res: Response) => {
  const { check_in, check_out } = req.query as Record<string, string>;
  if (!check_in || !check_out)
    return res.status(400).json({ error: 'Thiếu check_in hoặc check_out' });
  if (new Date(check_in) >= new Date(check_out))
    return res.status(400).json({ error: 'check_in phải trước check_out' });

  const conn = await pool.getConnection();
  try {
    // Sinh dãy ngày trong date range bằng subquery (không cần bảng phụ)
    // Dùng recursive CTE để sinh từng ngày từ check_in đến check_out (exclusive)
    const [rows] = await conn.execute(`
      WITH RECURSIVE date_range AS (
        SELECT DATE(?) AS d
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY)
        FROM date_range
        WHERE DATE_ADD(d, INTERVAL 1 DAY) < DATE(?)
      )
      SELECT
        dr.d                                                 AS date,
        rt.base_price,
        rtp.price                                            AS type_price,
        rp.price                                             AS room_price,
        COALESCE(rp.price, rtp.price, rt.base_price)        AS final_price
      FROM date_range dr
      CROSS JOIN rooms r ON r.room_id = ?
      JOIN  room_types rt              ON rt.type_id  = r.type_id
      LEFT JOIN room_type_prices rtp   ON rtp.type_id = rt.type_id AND rtp.date = dr.d
      LEFT JOIN room_prices rp         ON rp.room_id = r.room_id        AND rp.date  = dr.d
      ORDER BY dr.d
    `, [check_in, check_out, req.params.room_id]) as any[];

    const data = (rows as any[]).map((r: any) => ({
      date:        r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      base_price:  Number(r.base_price),
      type_price:  r.type_price  != null ? Number(r.type_price)  : null,
      room_price:  r.room_price  != null ? Number(r.room_price)  : null,
      final_price: Number(r.final_price),
    }));

    const subtotal = data.reduce((s: number, d: any) => s + d.final_price, 0);
    res.json({ data, subtotal });
  } finally { conn.release(); }
});

// PUT /api/rooms/units/:room_id/price — đặt giá override theo date range (batch upsert)
roomRouter.put('/units/:room_id/price', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { price, start_date, end_date, date } = req.body;
  if (!price || isNaN(Number(price))) return res.status(400).json({ error: 'Giá không hợp lệ' });
  const priceVal = Number(price);
  const roomId   = Number(req.params.room_id);
  const conn = await pool.getConnection();
  try {
    // Legacy: nếu chỉ truyền `date` đơn lẻ
    if (date && !start_date) {
      await conn.execute(
        `INSERT INTO room_prices (room_id, date, price) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE price = VALUES(price)`,
        [roomId, date, priceVal]
      );
      return res.json({ success: true, updated: 1 });
    }

    const from = start_date ?? new Date().toISOString().split('T')[0];
    const to   = end_date   ?? from;
    if (new Date(from) > new Date(to))
      return res.status(400).json({ error: 'start_date phải ≤ end_date' });

    // Tạo danh sách ngày phía server (tránh CTE để tương thích MySQL 5.x cũ)
    const days: string[] = [];
    const cur = new Date(from);
    const last = new Date(to);
    while (cur <= last) {
      days.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    if (!days.length) return res.json({ success: true, updated: 0 });

    // Batch INSERT ... ON DUPLICATE KEY UPDATE
    const placeholders = days.map(() => '(?,?,?)').join(',');
    const vals: any[] = [];
    days.forEach((d) => vals.push(roomId, d, priceVal));

    await conn.execute(
      `INSERT INTO room_prices (room_id, date, price) VALUES ${placeholders}
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      vals
    );
    res.json({ success: true, updated: days.length });
  } finally { conn.release(); }
});

// DELETE /api/rooms/units/:room_id/price — xóa giá override theo date range
roomRouter.delete('/units/:room_id/price', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { start_date, end_date } = req.body ?? {};
  const roomId = Number(req.params.room_id);
  const conn = await pool.getConnection();
  try {
    if (start_date && end_date) {
      // Xóa chỉ trong range
      await conn.execute(
        'DELETE FROM room_prices WHERE room_id = ? AND date BETWEEN ? AND ?',
        [roomId, start_date, end_date]
      );
    } else {
      // Legacy: xóa tất cả override của phòng
      await conn.execute('DELETE FROM room_prices WHERE room_id = ?', [roomId]);
    }
    res.json({ success: true });
  } finally { conn.release(); }
});

// GET /api/rooms/units/:room_id/images
roomRouter.get('/units/:room_id/images', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT image_id, url FROM room_images WHERE room_id = ? ORDER BY image_id',
      [req.params.room_id]
    ) as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// POST /api/rooms/units/:room_id/images
roomRouter.post('/units/:room_id/images', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Thiếu URL ảnh' });
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO room_images (room_id, url) VALUES (?,?)',
      [req.params.room_id, url]
    ) as any[];
    res.status(201).json({ image_id: (result as any).insertId, url });
  } finally { conn.release(); }
});

// GET /api/rooms/units/:room_id/bookings
roomRouter.get('/units/:room_id/bookings', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT b.booking_id, b.status, b.created_at,
             br.check_in, br.check_out,
             u.full_name, u.email, u.phone
      FROM booking_rooms br
      JOIN bookings b ON b.booking_id = br.booking_id
      JOIN users u    ON u.user_id = b.user_id
      WHERE br.room_id = ?
      ORDER BY br.check_in DESC
      LIMIT 50
    `, [req.params.room_id]) as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// DELETE /api/rooms/images/:image_id
roomRouter.delete('/images/:image_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM room_images WHERE image_id = ?', [req.params.image_id]);
    res.json({ success: true });
  } finally { conn.release(); }
});

// GET /api/rooms/debug/images
roomRouter.get('/debug/images', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT image_id, room_id, LEFT(url, 120) as url_preview, LENGTH(url) as url_len FROM room_images ORDER BY room_id, image_id'
    ) as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// POST /api/rooms/admin/fix-images
roomRouter.post('/admin/fix-images', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT image_id, room_id, url FROM room_images ORDER BY room_id, image_id'
    ) as any[];
    const toDelete: number[] = [];
    const toUpdate: { id: number; url: string }[] = [];
    for (let i = 0; i < (rows as any[]).length - 1; i++) {
      const cur = (rows as any[])[i], next = (rows as any[])[i + 1];
      if (cur.room_id === next.room_id &&
          (cur.url === 'data:image/jpeg;base64' || cur.url === 'data:image/png;base64')) {
        toUpdate.push({ id: cur.image_id, url: cur.url + ',' + next.url });
        toDelete.push(next.image_id);
        i++;
      }
    }
    for (const u of toUpdate)
      await conn.execute('UPDATE room_images SET url = ? WHERE image_id = ?', [u.url, u.id]);
    if (toDelete.length)
      await conn.execute(`DELETE FROM room_images WHERE image_id IN (${toDelete.join(',')})`, []);
    res.json({ fixed: toUpdate.length, deleted: toDelete.length });
  } finally { conn.release(); }
});

// GET /api/rooms/admin/units-status?date=YYYY-MM-DD — trạng thái phòng theo ngày (admin)
roomRouter.get('/admin/units-status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT
        r.room_id,
        r.room_number,
        r.floor,
        r.status        AS db_status,
        r.room_note,
        rt.type_id,
        rt.name         AS type_name,
        rt.base_price,
        COALESCE(MAX(rp.price), rt.base_price) AS effective_price,
        GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
        MIN(ri.url)     AS first_image,
        -- Có booking active vào ngày này không?
        MAX(CASE
          WHEN b.status IN ('CONFIRMED','PENDING')
            AND br.check_in  <= ?
            AND br.check_out >  ?
          THEN 1 ELSE 0
        END) AS is_booked,
        -- Khách vừa check-out hôm nay (đang dọn phòng)?
        MAX(CASE
          WHEN b.status = 'COMPLETED'
            AND DATE(br.check_out) = ?
          THEN 1 ELSE 0
        END) AS is_cleaning,
        -- Thông tin booking hiện tại (active)
        MAX(CASE WHEN b.status IN ('CONFIRMED','PENDING') AND br.check_in <= ? AND br.check_out > ? THEN br.check_in  END) AS booking_check_in,
        MAX(CASE WHEN b.status IN ('CONFIRMED','PENDING') AND br.check_in <= ? AND br.check_out > ? THEN br.check_out END) AS booking_check_out,
        MAX(CASE WHEN b.status IN ('CONFIRMED','PENDING') AND br.check_in <= ? AND br.check_out > ? THEN br.check_in_time  END) AS booking_check_in_time,
        MAX(CASE WHEN b.status IN ('CONFIRMED','PENDING') AND br.check_in <= ? AND br.check_out > ? THEN br.check_out_time END) AS booking_check_out_time,
        MAX(CASE WHEN b.status IN ('CONFIRMED','PENDING') AND br.check_in <= ? AND br.check_out > ? THEN b.booking_id END) AS active_booking_id
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_prices rp      ON rp.room_id = r.room_id AND rp.date = ?
      LEFT JOIN room_type_beds rtb  ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt        ON rtb.bed_id = bt.bed_id
      LEFT JOIN room_images ri      ON ri.room_id = r.room_id
      LEFT JOIN booking_rooms br    ON br.room_id = r.room_id
      LEFT JOIN bookings b          ON b.booking_id = br.booking_id
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.type_id, rt.name, rt.base_price
      ORDER BY r.floor ASC, r.room_number ASC
    `, [date, date, date,
        date, date, date, date, date, date, date, date, date, date,
        date]) as any[];

    res.json(rows.map((r: any) => {
      let display_status: string;
      if (r.db_status === 'MAINTENANCE') {
        display_status = 'MAINTENANCE';
      } else if (r.db_status === 'CLEANING') {
        display_status = 'CLEANING';
      } else if (r.db_status === 'INACTIVE') {
        display_status = 'INACTIVE';
      } else if (r.is_booked) {
        display_status = 'BOOKED';
      } else {
        display_status = 'AVAILABLE';
      }
      return {
        room_id:          r.room_id,
        room_number:      r.room_number,
        floor:            r.floor,
        db_status:        r.db_status,
        display_status,
        room_note:        r.room_note ?? null,
        type_id:          r.type_id,
        type_name:        r.type_name,
        base_price:       r.base_price,
        effective_price:  r.effective_price,
        first_image:      r.first_image ?? null,
        beds: r.beds ? r.beds.split(',').map((b: string) => {
          const [name, qty] = b.split(':');
          return { name, quantity: Number(qty) };
        }) : [],
        // Booking hiện tại (nếu đang có khách)
        booking: display_status === 'BOOKED' ? {
          booking_id:      r.active_booking_id ?? null,
          check_in:        r.booking_check_in   ? r.booking_check_in.toISOString().split('T')[0]  : null,
          check_out:       r.booking_check_out  ? r.booking_check_out.toISOString().split('T')[0] : null,
          check_in_time:   r.booking_check_in_time  ?? '14:00',
          check_out_time:  r.booking_check_out_time ?? '11:00',
        } : null,
      };
    }));
  } finally { conn.release(); }
});

// GET /api/rooms/physical/:room_id — Public access for physical room details
roomRouter.get('/physical/:room_id', h(async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    // 1 query: lấy thông tin phòng + ảnh riêng của phòng
    const [rows] = await conn.execute(`
      SELECT r.room_id, r.room_number, r.floor, r.status, r.room_note,
             rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.description,
             rt.area_sqm, rc.name AS category_name,
             MAX(rp.price) AS override_price,
             GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
             GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ',') AS amenities,
             (SELECT GROUP_CONCAT(url ORDER BY image_id SEPARATOR '|||')
              FROM room_images WHERE room_id = r.room_id) AS own_images
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_categories rc      ON rt.category_id = rc.category_id
      LEFT JOIN room_prices rp          ON rp.room_id = r.room_id AND rp.date = CURDATE()
      LEFT JOIN room_type_beds rtb      ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt            ON rtb.bed_id = bt.bed_id
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      WHERE r.room_id = ?
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.type_id, rt.name, rt.base_price, rt.capacity, rt.description, rt.area_sqm, rc.name
    `, [req.params.room_id]) as any[];

    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy phòng vật lý' });
    const r = rows[0];

    // Chỉ dùng ảnh riêng của phòng, không fallback sang phòng khác
    const finalImages: string[] = r.own_images
      ? r.own_images.split('|||').filter(Boolean)
      : [];

    res.json({
      room_id:             r.room_id,
      room_number:         r.room_number,
      floor:               r.floor,
      status:              r.status,
      room_note:           r.room_note ?? null,
      type_id:             r.type_id,
      type_name:           r.type_name,
      base_price:          r.base_price,
      capacity:            r.capacity,
      description:         r.description ?? '',
      area_sqm:            r.area_sqm ?? null,
      category_name:       r.category_name ?? null,
      override_price:      r.override_price ?? null,
      effective_price:     r.override_price ?? r.base_price,
      availability_status: r.status,
      beds: r.beds ? r.beds.split(',').map((b: string) => {
        const [name, qty] = b.split(':');
        return { name, quantity: Number(qty) };
      }) : [],
      amenities: r.amenities ? r.amenities.split(',') : [],
      images: finalImages,
      image:  finalImages[0] ?? null,
    });
  } finally { conn.release(); }
}));

// GET /api/rooms/physical/:room_id/availability — inventory calendar + grouped unavailable ranges
roomRouter.get('/physical/:room_id/availability', h(async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [roomRows] = await conn.execute(
      'SELECT room_id FROM rooms WHERE room_id = ? LIMIT 1',
      [req.params.room_id]
    ) as any[];

    if (!(roomRows as any[]).length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng', code: 'ROOM_NOT_FOUND' });
    }

    // Kết hợp room_inventory (block tay/giá) và booking_rooms (đặt thực tế)
    // Dùng CTE sinh 120 ngày tiếp theo để đảm bảo lịch luôn có dữ liệu đầy đủ
    const [rows] = await conn.execute(`
      WITH RECURSIVE days AS (
        SELECT CURDATE() as d
        UNION ALL
        SELECT DATE_ADD(d, INTERVAL 1 DAY)
        FROM days
        WHERE d < DATE_ADD(CURDATE(), INTERVAL 120 DAY)
      )
      SELECT 
        dr.d AS date,
        CASE 
          WHEN MAX(inv.status) IS NOT NULL AND MAX(inv.status) != 'AVAILABLE' THEN MAX(inv.status)
          WHEN MAX(b.booking_id) IS NOT NULL THEN 
            CASE 
              WHEN MAX(b.status) = 'PENDING' THEN 'PENDING'
              ELSE 'BOOKED'
            END
          ELSE 'AVAILABLE'
        END AS status
      FROM days dr
      LEFT JOIN room_inventory inv ON inv.room_id = ? AND inv.date = dr.d
      LEFT JOIN booking_rooms br   ON br.room_id = ? AND dr.d >= br.check_in AND dr.d < br.check_out
      LEFT JOIN bookings b        ON b.booking_id = br.booking_id AND b.status NOT IN ('CANCELLED')
      GROUP BY dr.d
      ORDER BY dr.d ASC
    `, [req.params.room_id, req.params.room_id]) as any[];


    const data = (rows as any[]).map((row: any) => ({
      date: formatDateOnly(row.date),
      status: String(row.status ?? 'AVAILABLE'),
    }));

    res.json({
      data,
      booked_ranges: buildUnavailableRanges(data),
    });
  } finally { conn.release(); }
}));


// GET /api/rooms/physical/:room_id/similar
roomRouter.get('/physical/:room_id/similar', h(async (req: Request, res: Response) => {
  const { room_id } = req.params;
  const { check_in, check_out } = req.query;
  const conn = await pool.getConnection();

  try {
    // 1. Lấy type_id của phòng hiện tại
    const [curr] = await conn.execute(
      'SELECT type_id FROM rooms WHERE room_id = ?',
      [room_id]
    ) as any[];
    if (!curr.length) return res.json([]);
    const type_id = curr[0].type_id;

    // 2. Base query:Tìm các phòng cùng loại, loại trừ phòng hiện tại
    let query = `
      SELECT r.room_id, r.room_number, r.floor, r.status, r.room_note,
             rt.name AS type_name, rt.base_price, rt.capacity, rt.area_sqm,
             MAX(rp.price) AS override_price,
             (SELECT url FROM room_images WHERE room_id = r.room_id ORDER BY image_id LIMIT 1) AS image
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_prices rp ON rp.room_id = r.room_id AND rp.date = CURDATE()
      WHERE r.type_id = ? AND r.room_id != ? AND r.status = 'ACTIVE'
    `;
    const params: any[] = [type_id, room_id];

    // Optional: filter by available inventory if check_in/out provided
    if (check_in && check_out) {
      const nights = Math.max(1, Math.floor((new Date(check_out as string).getTime() - new Date(check_in as string).getTime()) / 86400000));
      query += `
        AND r.room_id IN (
          SELECT inv.room_id
          FROM room_inventory inv
          WHERE inv.date >= ? AND inv.date < ? AND inv.status = 'AVAILABLE'
          GROUP BY inv.room_id
          HAVING COUNT(inv.inventory_id) >= ?
        )
      `;
      params.push(check_in, check_out, nights);
    }

    query += `
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.name, rt.base_price, rt.capacity, rt.area_sqm
      LIMIT 8
    `;

    const [rows] = await conn.execute(query, params) as any[];
    res.json(rows.map((r: any) => ({
      ...r,
      effective_price: r.override_price ?? r.base_price,
      override_price:  r.override_price ?? null,
      image:           r.image ?? null,
    })));
  } finally { conn.release(); }
}));

// GET /api/rooms/recommendations — gợi ý phòng thông minh
roomRouter.get('/recommendations', optionalAuth, async (req: AuthRequest, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const conn = await pool.getConnection();

  try {
    const [roomTypes] = await conn.execute(`
      SELECT 
        rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.description,
        GROUP_CONCAT(DISTINCT a.name) AS amenities,
        MIN(ri.url) AS image,
        MIN(r.room_id) AS first_room_id,
        COALESCE((SELECT COUNT(*) FROM booking_rooms br JOIN rooms r ON br.room_id = r.room_id WHERE r.type_id = rt.type_id), 0) AS booking_count,
        COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews rv WHERE rv.room_type_id = rt.type_id AND rv.status = 'VISIBLE'), 0) AS rating
      FROM room_types rt
      JOIN rooms r ON rt.type_id = r.type_id AND r.status = 'ACTIVE'
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a ON rta.amenity_id = a.amenity_id
      LEFT JOIN room_images ri ON ri.room_id = r.room_id
      GROUP BY rt.type_id
    `) as any[];

    const types = roomTypes.map((t: any) => ({
      ...t,
      amenities: t.amenities ? t.amenities.split(',') : [],
      base_price: Number(t.base_price),
      booking_count: Number(t.booking_count),
      rating: Number(t.rating)
    }));

    if (!req.userId) {
      types.sort((a: any, b: any) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.booking_count !== a.booking_count) return b.booking_count - a.booking_count;
        return a.base_price - b.base_price;
      });
      return res.json(types.slice(0, limit));
    }

    const [history] = await conn.execute(`
      SELECT r.type_id, br.price, GROUP_CONCAT(DISTINCT a.name) AS booked_amenities
      FROM bookings b
      JOIN booking_rooms br ON b.booking_id = br.booking_id
      JOIN rooms r ON br.room_id = r.room_id
      LEFT JOIN room_type_amenities rta ON r.type_id = rta.type_id
      LEFT JOIN amenities a ON rta.amenity_id = a.amenity_id
      WHERE b.user_id = ? AND b.status IN ('COMPLETED', 'CONFIRMED')
      GROUP BY br.booking_room_id
    `, [req.userId]) as any[];

    if (!history.length) {
      types.sort((a: any, b: any) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.booking_count !== a.booking_count) return b.booking_count - a.booking_count;
        return a.base_price - b.base_price;
      });
      return res.json(types.slice(0, limit));
    }

    let totalPrice = 0;
    const typeFreq: Record<number, number> = {};
    const userAmenitiesSet = new Set<string>();

    history.forEach((h: any) => {
      totalPrice += Number(h.price);
      typeFreq[h.type_id] = (typeFreq[h.type_id] || 0) + 1;
      if (h.booked_amenities) {
        h.booked_amenities.split(',').forEach((am: string) => userAmenitiesSet.add(am));
      }
    });

    const avgPrice = totalPrice / history.length;
    const maxFreq = Math.max(...Object.values(typeFreq), 1);
    const maxBookingCount = Math.max(...types.map((t: any) => t.booking_count), 1);
    const userAmenities = Array.from(userAmenitiesSet);

    const isSingleBooking = history.length === 1;
    const wType = isSingleBooking ? 0.3 : 0.4;
    const wRating = 0.2;
    const wPrice = 0.2;
    const wAmen = 0.1;
    const wPop = isSingleBooking ? 0.2 : 0.1;

    types.forEach((t: any) => {
      const type_match = (typeFreq[t.type_id] || 0) / maxFreq;
      const rating_normalized = t.rating / 5;
      const price_proximity = 1 - Math.min(Math.abs(t.base_price - avgPrice) / avgPrice, 1);
      const popularity_normalized = t.booking_count / maxBookingCount;
      
      let amenities_similarity = 0;
      if (userAmenities.length > 0 && t.amenities.length > 0) {
        const intersection = t.amenities.filter((am: string) => userAmenities.includes(am));
        amenities_similarity = intersection.length / userAmenities.length;
      } else if (userAmenities.length === 0) {
        amenities_similarity = 1;
      }

      t.score = (wType * type_match) +
                (wRating * rating_normalized) +
                (wPrice * price_proximity) +
                (wAmen * amenities_similarity) +
                (wPop * popularity_normalized);
    });

    types.sort((a: any, b: any) => b.score - a.score);
    res.json(types.slice(0, limit));

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /api/rooms/available?check_in=&check_out= — phòng còn trống theo room_inventory
roomRouter.get('/available', async (req: Request, res: Response) => {
  const { check_in, check_out } = req.query;
  if (!check_in || !check_out)
    return res.status(400).json({ success: false, message: 'Thiếu check_in hoặc check_out', code: 'MISSING_FIELDS' });

  const conn = await pool.getConnection();
  try {
    const nights = Math.max(1, Math.floor(
      (new Date(check_out as string).getTime() - new Date(check_in as string).getTime()) / 86400000
    ));

    // Phòng đủ inventory và không có ngày conflict trong range
    const [rows] = await conn.execute(`
      SELECT
        r.room_id, r.room_number, r.floor, r.status, r.room_note,
        rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity,
        rt.description, rt.area_sqm,
        rc.name AS category_name,
        COALESCE(SUM(inv.price), rt.base_price * ?) AS total_inventory_price,
        COUNT(inv.inventory_id) AS inventory_days,
        SUM(CASE WHEN inv.status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_days,
        SUM(CASE WHEN inv.status IN ('BOOKED', 'PENDING', 'BLOCKED') THEN 1 ELSE 0 END) AS conflict_days,
        GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ',') AS amenities,
        GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
        MIN(ri.url) AS image
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_categories rc      ON rt.category_id = rc.category_id
      LEFT JOIN room_inventory inv      ON inv.room_id = r.room_id
        AND inv.date >= ? AND inv.date < ?
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      LEFT JOIN room_type_beds rtb      ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt            ON rtb.bed_id = bt.bed_id
      LEFT JOIN room_images ri          ON ri.room_id = r.room_id
      WHERE r.status = 'ACTIVE'
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.type_id, rt.name, rt.base_price, rt.capacity, rt.description, rt.area_sqm, rc.name
      HAVING inventory_days >= ? AND available_days >= ? AND conflict_days = 0
      ORDER BY rt.base_price ASC, r.floor ASC
    `, [nights, check_in, check_out, nights, nights]) as any[];

    res.json((rows as any[]).map((r: any) => ({
      room_id:              r.room_id,
      room_number:          r.room_number,
      floor:                r.floor,
      room_note:            r.room_note ?? null,
      type_id:              r.type_id,
      type_name:            r.type_name,
      base_price:           r.base_price,
      total_price:          Number(r.total_inventory_price),
      capacity:             r.capacity,
      description:          r.description ?? '',
      area_sqm:             r.area_sqm ?? null,
      category_name:        r.category_name ?? null,
      amenities:            r.amenities ? r.amenities.split(',') : [],
      beds:                 r.beds ? r.beds.split(',').map((b: string) => {
        const [name, qty] = b.split(':');
        return { name, quantity: Number(qty) };
      }) : [],
      image:                r.image ?? null,
    })));
  } finally {
    conn.release();
  }
});

// GET /api/rooms/all-units — tất cả phòng vật lý (public, dùng cho RoomList)
roomRouter.get('/all-units', async (req: Request, res: Response) => {
  const { min_price, max_price, capacity, check_in, check_out } = req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    const where: string[] = ['r.status = ?'];
    params.push('ACTIVE');

    if (min_price) { where.push('rt.base_price >= ?'); params.push(Number(min_price)); }
    if (max_price) { where.push('rt.base_price <= ?'); params.push(Number(max_price)); }
    if (capacity)  { where.push('rt.capacity >= ?');   params.push(Number(capacity)); }

    if (check_in && check_out) {
      where.push(`r.room_id NOT IN (
        SELECT br.room_id FROM booking_rooms br
        JOIN bookings b ON b.booking_id = br.booking_id
        WHERE b.status NOT IN ('CANCELLED')
          AND br.check_in < ? AND br.check_out > ?
      )`);
      params.push(check_out, check_in);
    }

    const sql = `
      SELECT r.room_id, r.room_number, r.floor, r.status, r.room_note,
             rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity, rt.description,
             COALESCE(MAX(rp.price), rt.base_price) AS effective_price,
             GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ',') AS amenities,
             GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
             (SELECT url FROM room_images WHERE room_id = r.room_id ORDER BY image_id LIMIT 1) AS image
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_prices rp          ON rp.room_id = r.room_id AND rp.date = CURDATE()
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      LEFT JOIN room_type_beds rtb      ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt            ON rtb.bed_id = bt.bed_id
      WHERE ${where.join(' AND ')}
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.type_id, rt.name, rt.base_price, rt.capacity, rt.description
      ORDER BY effective_price ASC, r.floor ASC, r.room_number ASC
    `;

    const [rows] = await conn.execute(sql, params) as any[];
    res.json(rows.map((r: any) => ({
      ...r,
      amenities: r.amenities ? r.amenities.split(',') : [],
      beds: r.beds ? r.beds.split(',').map((b: string) => {
        const [name, qty] = b.split(':');
        return { name, quantity: Number(qty) };
      }) : [],
    })));
  } finally { conn.release(); }
});

// ── GET / (list with filters) ─────────────────────────────────────────────────
roomRouter.get('/', async (req: Request, res: Response) => {
  const { type_id, min_price, max_price, check_in, check_out, capacity } = req.query;
  const conn = await pool.getConnection();
  try {
    let sql = `
      SELECT rt.type_id, rt.name AS type_name, rt.description, rt.base_price, rt.capacity,
             rt.area_sqm,
             rc.name AS category_name,
             GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ',') AS amenities,
             GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
             MIN(ri.url) AS image,
             COUNT(DISTINCT r.room_id) AS room_count,
             MIN(r.room_id) AS first_room_id,
             GROUP_CONCAT(DISTINCT CONCAT(r.room_number, '|', r.floor) ORDER BY r.floor, r.room_number SEPARATOR ',') AS room_list
      FROM room_types rt
      LEFT JOIN room_categories rc      ON rt.category_id = rc.category_id
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      LEFT JOIN room_type_beds rtb      ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt            ON rtb.bed_id = bt.bed_id
      LEFT JOIN rooms r                 ON r.type_id = rt.type_id AND r.status = 'ACTIVE'
      LEFT JOIN room_images ri          ON ri.room_id = r.room_id
    `;
    const params: any[] = [];
    const where: string[] = [];

    if (type_id)   { where.push('rt.type_id = ?');    params.push(Number(type_id)); }
    if (min_price) { where.push('rt.base_price >= ?'); params.push(Number(min_price)); }
    if (max_price) { where.push('rt.base_price <= ?'); params.push(Number(max_price)); }
    if (capacity)  { where.push('rt.capacity >= ?');   params.push(Number(capacity)); }

    if (check_in && check_out) {
      where.push(`rt.type_id IN (
        SELECT DISTINCT r2.type_id FROM rooms r2
        WHERE r2.status = 'ACTIVE'
          AND r2.room_id NOT IN (
            SELECT br.room_id FROM booking_rooms br
            JOIN bookings b ON b.booking_id = br.booking_id
            WHERE b.status NOT IN ('CANCELLED')
              AND br.check_in  < ? AND br.check_out > ?
          )
      )`);
      params.push(check_out, check_in);
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' GROUP BY rt.type_id ORDER BY rt.base_price ASC';

    const [rows] = await conn.execute(sql, params) as any[];
    res.json(rows.map((r: any) => ({
      ...r,
      amenities: r.amenities ? r.amenities.split(',') : [],
      beds: r.beds ? r.beds.split(',').map((b: string) => {
        const [name, qty] = b.split(':');
        return { name, quantity: Number(qty) };
      }) : [],
      room_count: r.room_count ?? 0,
      first_room_id: r.first_room_id ?? null,
      rooms: r.room_list
        ? r.room_list.split(',').map((s: string) => {
            const [room_number, floor] = s.split('|');
            return { room_number, floor: Number(floor) };
          })
        : [],
    })));
  } finally { conn.release(); }
});

// ── POST / (Admin — create room type) ────────────────────────────────────────
roomRouter.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, base_price, capacity, category_id, area_sqm, beds } = req.body;
  if (!name || !base_price) return res.status(400).json({ error: 'Thiếu thông tin' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      'INSERT INTO room_types (name, description, base_price, capacity, category_id, area_sqm) VALUES (?,?,?,?,?,?)',
      [name, description ?? null, base_price, capacity ?? 2, category_id ?? null, area_sqm ?? null]
    ) as any[];
    const typeId = (result as any).insertId;

    if (Array.isArray(beds) && beds.length > 0) {
      for (const b of beds) {
        if (b.bed_id) {
          await conn.execute(
            'INSERT INTO room_type_beds (type_id, bed_id, quantity) VALUES (?, ?, ?)',
            [typeId, Number(b.bed_id), Number(b.quantity ?? 1)]
          );
        }
      }
    }

    await conn.commit();
    res.status(201).json({ type_id: typeId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
});

// ── GET /api/rooms/pricing-rules — quy tắc giá early/late (public)
roomRouter.get('/pricing-rules', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT rule_id, rule_type, start_hour, end_hour, percent, description
       FROM pricing_rules WHERE is_active = 1 ORDER BY rule_type, start_hour`
    ) as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// ── GET /api/rooms/categories/list — danh sách category (public)
roomRouter.get('/categories/list', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT * FROM room_categories ORDER BY category_id') as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// GET /api/rooms/bed-types/list — danh sách loại giường (public)
roomRouter.get('/bed-types/list', async (_req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT * FROM bed_types ORDER BY bed_id') as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// ── GET /api/rooms/:type_id — detail
roomRouter.get('/:type_id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [types] = await conn.execute(`
      SELECT rt.*, rc.name AS category_name
      FROM room_types rt
      LEFT JOIN room_categories rc ON rt.category_id = rc.category_id
      WHERE rt.type_id = ?
    `, [req.params.type_id]) as any[];
    if (!types[0]) return res.status(404).json({ error: 'Không tìm thấy loại phòng' });

    const [amenityRows] = await conn.execute(`
      SELECT a.name FROM amenities a
      JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
      WHERE rta.type_id = ?
    `, [req.params.type_id]) as any[];

    const [bedRows] = await conn.execute(`
      SELECT bt.name, rtb.quantity
      FROM room_type_beds rtb
      JOIN bed_types bt ON rtb.bed_id = bt.bed_id
      WHERE rtb.type_id = ?
    `, [req.params.type_id]) as any[];

    const [rooms] = await conn.execute(`
      SELECT r.room_id, r.room_number, r.floor, r.status, r.room_note,
             GROUP_CONCAT(ri.url SEPARATOR '|||') AS images
      FROM rooms r
      LEFT JOIN room_images ri ON ri.room_id = r.room_id
      WHERE r.type_id = ? AND r.status = 'ACTIVE'
      GROUP BY r.room_id
    `, [req.params.type_id]) as any[];

    res.json({
      ...types[0],
      amenities: amenityRows.map((a: any) => a.name),
      beds: bedRows,
      rooms: rooms.map((r: any) => ({ ...r, images: r.images ? r.images.split('|||') : [] })),
    });
  } finally { conn.release(); }
});

// PUT /api/rooms/:type_id (Admin)
roomRouter.put('/:type_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, base_price, capacity, category_id, area_sqm, beds } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Cập nhật room_types — chỉ update field nào được gửi
    const sets: string[] = [];
    const vals: any[] = [];
    if (name        !== undefined) { sets.push('name = ?');        vals.push(name); }
    if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
    if (base_price  !== undefined) { sets.push('base_price = ?');  vals.push(Number(base_price)); }
    if (capacity    !== undefined) { sets.push('capacity = ?');    vals.push(Number(capacity)); }
    if (category_id !== undefined) { sets.push('category_id = ?'); vals.push(category_id ?? null); }
    if (area_sqm    !== undefined) { sets.push('area_sqm = ?');    vals.push(area_sqm ?? null); }

    if (sets.length) {
      vals.push(req.params.type_id);
      await conn.execute(`UPDATE room_types SET ${sets.join(', ')} WHERE type_id = ?`, vals);
    }

    // Sync giường nếu được gửi (Xóa cũ - Thêm mới để đảm bảo tính nhất quán)
    if (beds !== undefined) {
      await conn.execute('DELETE FROM room_type_beds WHERE type_id = ?', [req.params.type_id]);
      if (Array.isArray(beds) && beds.length > 0) {
        for (const b of beds) {
          if (b.bed_id) {
            await conn.execute(
              'INSERT INTO room_type_beds (type_id, bed_id, quantity) VALUES (?, ?, ?)',
              [req.params.type_id, Number(b.bed_id), Number(b.quantity ?? 1)]
            );
          }
        }
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
});

// DELETE /api/rooms/:type_id (Admin)
roomRouter.delete('/:type_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM room_types WHERE type_id = ?', [req.params.type_id]);
    res.json({ success: true });
  } finally { conn.release(); }
});

// GET /api/rooms/:type_id/units
roomRouter.get('/:type_id/units', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT r.room_id, r.room_number, r.floor, r.status, r.room_note,
              rt.base_price,
              MAX(rp.price) AS override_price,
              GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
              GROUP_CONCAT(ri.url ORDER BY ri.image_id SEPARATOR '|||') AS images_concat
       FROM rooms r
       JOIN room_types rt ON r.type_id = rt.type_id
       LEFT JOIN room_prices rp    ON rp.room_id = r.room_id AND rp.date = CURDATE()
       LEFT JOIN room_type_beds rtb ON rt.type_id = rtb.type_id
       LEFT JOIN bed_types bt       ON rtb.bed_id = bt.bed_id
       LEFT JOIN room_images ri     ON ri.room_id = r.room_id
       WHERE r.type_id = ?
       GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note, rt.base_price
       ORDER BY r.floor, r.room_number`,
      [req.params.type_id]
    ) as any[];
    res.json(rows.map((r: any) => ({
      room_id: r.room_id,
      room_number: r.room_number,
      floor: r.floor,
      status: r.status,
      room_note: r.room_note ?? null,
      base_price: r.base_price,
      override_price: r.override_price ?? null,
      effective_price: r.override_price ?? r.base_price,
      beds: r.beds ? r.beds.split(',').map((b: string) => {
        const [name, qty] = b.split(':');
        return { name, quantity: Number(qty) };
      }) : [],
      first_image: r.images_concat ? r.images_concat.split('|||')[0] : null,
    })));
  } finally { conn.release(); }
});

// POST /api/rooms/:type_id/units
roomRouter.post('/:type_id/units', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { room_number, floor } = req.body;
  if (!room_number) return res.status(400).json({ error: 'Thiếu số phòng' });
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO rooms (type_id, room_number, floor, status) VALUES (?,?,?,?)',
      [req.params.type_id, room_number, floor ?? 1, 'ACTIVE']
    ) as any[];
    res.status(201).json({ room_id: (result as any).insertId });
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: `Số phòng "${room_number}" đã tồn tại` });
    res.status(500).json({ error: e.message ?? 'Lỗi server' });
  } finally { conn.release(); }
});

// GET /api/rooms/:type_id/amenities
roomRouter.get('/:type_id/amenities', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT a.amenity_id, a.name FROM amenities a
      JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
      WHERE rta.type_id = ?
    `, [req.params.type_id]) as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// POST /api/rooms/:type_id/amenities
roomRouter.post('/:type_id/amenities', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Thiếu tên tiện nghi' });
  const conn = await pool.getConnection();
  try {
    let [rows] = await conn.execute('SELECT amenity_id FROM amenities WHERE name = ?', [name]) as any[];
    let amenityId: number;
    if (rows.length) {
      amenityId = rows[0].amenity_id;
    } else {
      const [r] = await conn.execute('INSERT INTO amenities (name) VALUES (?)', [name]) as any[];
      amenityId = (r as any).insertId;
    }
    await conn.execute(
      'INSERT IGNORE INTO room_type_amenities (type_id, amenity_id) VALUES (?,?)',
      [req.params.type_id, amenityId]
    );
    res.status(201).json({ amenity_id: amenityId });
  } finally { conn.release(); }
});

// DELETE /api/rooms/:type_id/amenities/:amenity_id
roomRouter.delete('/:type_id/amenities/:amenity_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'DELETE FROM room_type_amenities WHERE type_id = ? AND amenity_id = ?',
      [req.params.type_id, req.params.amenity_id]
    );
    res.json({ success: true });
  } finally { conn.release(); }
});

// GET /api/rooms/:type_id/beds
roomRouter.get('/:type_id/beds', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT rtb.id, rtb.bed_id, bt.name, rtb.quantity
      FROM room_type_beds rtb
      JOIN bed_types bt ON rtb.bed_id = bt.bed_id
      WHERE rtb.type_id = ?
    `, [req.params.type_id]) as any[];
    res.json(rows);
  } finally { conn.release(); }
});

// POST /api/rooms/:type_id/beds
roomRouter.post('/:type_id/beds', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { bed_id, quantity } = req.body;
  if (!bed_id) return res.status(400).json({ error: 'Thiếu loại giường' });
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO room_type_beds (type_id, bed_id, quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)',
      [req.params.type_id, bed_id, quantity ?? 1]
    ) as any[];
    res.status(201).json({ id: (result as any).insertId });
  } finally { conn.release(); }
});

// DELETE /api/rooms/:type_id/beds/:bed_row_id
roomRouter.delete('/:type_id/beds/:bed_row_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM room_type_beds WHERE id = ? AND type_id = ?',
      [req.params.bed_row_id, req.params.type_id]);
    res.json({ success: true });
  } finally { conn.release(); }
});
