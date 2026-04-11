import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const roomRouter = Router();

// Wrap async route để tự động forward error đến global handler
const h = (fn: (req: any, res: Response, next: NextFunction) => Promise<any>) =>
  (req: any, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

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

// GET /api/rooms/units/:room_id/price — giá hiện tại của phòng (override hoặc base_price)
roomRouter.get('/units/:room_id/price', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    // Lấy base_price từ room_types và override price từ room_prices (nếu có)
    const [rows] = await conn.execute(`
      SELECT rt.base_price,
             rp.price AS override_price
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_prices rp ON rp.room_id = r.room_id AND rp.date = CURDATE()
      WHERE r.room_id = ?
    `, [req.params.room_id]) as any[];
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    res.json({
      base_price: rows[0].base_price,
      override_price: rows[0].override_price ?? null,
      effective_price: rows[0].override_price ?? rows[0].base_price,
    });
  } finally { conn.release(); }
});

// PUT /api/rooms/units/:room_id/price — đặt giá override cho phòng
roomRouter.put('/units/:room_id/price', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { price, date } = req.body;
  if (!price || isNaN(Number(price))) return res.status(400).json({ error: 'Giá không hợp lệ' });
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO room_prices (room_id, date, price)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [req.params.room_id, targetDate, Number(price)]
    );
    res.json({ success: true });
  } finally { conn.release(); }
});

// DELETE /api/rooms/units/:room_id/price — xóa giá override (về lại base_price)
roomRouter.delete('/units/:room_id/price', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const conn = await pool.getConnection();
  try {
    await conn.execute('DELETE FROM room_prices WHERE room_id = ?', [req.params.room_id]);
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
        END) AS is_cleaning
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
    `, [date, date, date, date]) as any[];

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
        room_id:        r.room_id,
        room_number:    r.room_number,
        floor:          r.floor,
        db_status:      r.db_status,
        display_status,
        room_note:      r.room_note ?? null,
        type_id:        r.type_id,
        type_name:      r.type_name,
        base_price:     r.base_price,
        effective_price: r.effective_price,
        first_image:    r.first_image ?? null,
        beds: r.beds ? r.beds.split(',').map((b: string) => {
          const [name, qty] = b.split(':');
          return { name, quantity: Number(qty) };
        }) : [],
      };
    }));
  } finally { conn.release(); }
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

    // Phòng có đủ ngày available trong room_inventory
    const [rows] = await conn.execute(`
      SELECT
        r.room_id, r.room_number, r.floor, r.status, r.room_note,
        rt.type_id, rt.name AS type_name, rt.base_price, rt.capacity,
        rt.description, rt.area_sqm,
        rc.name AS category_name,
        COALESCE(SUM(inv.price), rt.base_price * ?) AS total_inventory_price,
        COUNT(inv.inventory_id) AS available_days,
        GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ',') AS amenities,
        GROUP_CONCAT(DISTINCT CONCAT(bt.name, ':', rtb.quantity) ORDER BY bt.name SEPARATOR ',') AS beds,
        MIN(ri.url) AS image
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_categories rc      ON rt.category_id = rc.category_id
      LEFT JOIN room_inventory inv      ON inv.room_id = r.room_id
        AND inv.date >= ? AND inv.date < ? AND inv.is_available = 1
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      LEFT JOIN room_type_beds rtb      ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt            ON rtb.bed_id = bt.bed_id
      LEFT JOIN room_images ri          ON ri.room_id = r.room_id
      WHERE r.status = 'ACTIVE'
      GROUP BY r.room_id, r.room_number, r.floor, r.status, r.room_note,
               rt.type_id, rt.name, rt.base_price, rt.capacity, rt.description, rt.area_sqm, rc.name
      HAVING available_days >= ?
      ORDER BY rt.base_price ASC, r.floor ASC
    `, [nights, check_in, check_out, nights]) as any[];

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
             MIN(ri.url) AS image
      FROM rooms r
      JOIN room_types rt ON r.type_id = rt.type_id
      LEFT JOIN room_prices rp          ON rp.room_id = r.room_id AND rp.date = CURDATE()
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      LEFT JOIN room_type_beds rtb      ON rt.type_id = rtb.type_id
      LEFT JOIN bed_types bt            ON rtb.bed_id = bt.bed_id
      LEFT JOIN room_images ri          ON ri.room_id = r.room_id
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
