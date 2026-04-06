$content = @'
import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const roomRouter = Router();

// GET /api/rooms
roomRouter.get('/', async (req: Request, res: Response) => {
  const { type_id, min_price, max_price, check_in, check_out, capacity } = req.query;
  const conn = await pool.getConnection();
  try {
    let sql = `
      SELECT rt.type_id, rt.name AS type_name, rt.description, rt.base_price, rt.capacity,
             GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ',') AS amenities,
             MIN(ri.url) AS image
      FROM room_types rt
      LEFT JOIN room_type_amenities rta ON rt.type_id = rta.type_id
      LEFT JOIN amenities a             ON rta.amenity_id = a.amenity_id
      LEFT JOIN rooms r                 ON r.type_id = rt.type_id AND r.status = 'ACTIVE'
      LEFT JOIN room_images ri          ON ri.room_id = r.room_id
    `;
    const params: any[] = [];
    const where: string[] = [];
    if (type_id)   { where.push('rt.type_id = ?');    params.push(type_id); }
    if (min_price) { where.push('rt.base_price >= ?'); params.push(min_price); }
    if (max_price) { where.push('rt.base_price <= ?'); params.push(max_price); }
    if (capacity)  { where.push('rt.capacity >= ?');   params.push(capacity); }
    if (check_in && check_out) {
      where.push(`rt.type_id NOT IN (
        SELECT DISTINCT r2.type_id FROM rooms r2
        JOIN booking_rooms br ON br.room_id = r2.room_id
        JOIN bookings b ON b.booking_id = br.booking_id
        WHERE b.status NOT IN ('CANCELLED') AND br.check_in < ? AND br.check_out > ?
      )`);
      params.push(check_out, check_in);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' GROUP BY rt.type_id ORDER BY rt.base_price ASC';
    const [rows] = await conn.execute(sql, params) as any[];
    res.json(rows.map((r: any) => ({ ...r, amenities: r.amenities ? r.amenities.split(',') : [] })));
  } finally { conn.release(); }
});

// GET /api/rooms/:type_id
roomRouter.get('/:type_id', async (req: Request, res: Response) => {
  const conn = await pool.getConnection();
  try {
    const [types] = await conn.execute('SELECT * FROM room_types WHERE type_id = ?', [req.params.type_id]) as any[];
    if (!types[0]) return res.status(404).json({ error: 'Khong tim thay loai phong' });
    const [amenities] = await conn.execute(`
      SELECT a.amenity_id, a.name FROM amenities a
      JOIN room_type_amenities rta ON a.amenity_id = rta.amenity_id
      WHERE rta.type_id = ?`, [req.params.type_id]) as any[];
    const [rooms] = await conn.execute(`
      SELECT r.room_id, r.room_number, r.floor, r.status,
             GROUP_CONCAT(ri.url SEPARATOR ',') AS images
      FROM rooms r LEFT JOIN room_images ri ON ri.room_id = r.room_id
      WHERE r.type_id = ? AND r.status = 'ACTIVE' GROUP BY r.room_id`, [req.params.type_id]) as any[];
    res.json({ ...types[0], amenities, rooms: rooms.map((r: any) => ({ ...r, images: r.images ? r.images.split(',') : [] })) });
  } finally { conn.release(); }
});

// POST /api/rooms (Admin)
roomRouter.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, base_price, capacity } = req.body;
  if (!name || !base_price) return res.status(400).json({ error: 'Thieu thong tin' });
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO room_types (name, description, base_price, capacity) VALUES (?,?,?,?)',
      [name, description ?? null, base_price, capacity ?? 2]) as any[];
    res.status(201).json({ type_id: result.insertId });
  } finally { conn.release(); }
});

// PUT /api/rooms/:type_id (Admin)
roomRouter.put('/:type_id', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, base_price, capacity } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'UPDATE room_types SET name=COALESCE(?,name), description=COALESCE(?,description), base_price=COALESCE(?,base_price), capacity=COALESCE(?,capacity) WHERE type_id=?',
      [name ?? null, description ?? null, base_price ?? null, capacity ?? null, req.params.type_id]);
    res.json({ success: true });
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
'@
Set-Content -Path 'D:\demo_khoaluan\BE\src\routes\rooms.ts' -Value $content -Encoding UTF8
Write-Host "Done. Lines: $((Get-Content 'D:\demo_khoaluan\BE\src\routes\rooms.ts' | Measure-Object -Line).Lines)"
