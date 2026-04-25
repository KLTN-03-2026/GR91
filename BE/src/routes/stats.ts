import { Router, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';

export const statsRouter = Router();

// GET /api/stats (Admin)
statsRouter.get('/', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { start_date, end_date } = _req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    let whereClause = "WHERE status != 'CANCELLED'";
    if (start_date && end_date) {
      whereClause += " AND created_at BETWEEN ? AND ?";
      params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
    }

    // 1. Total revenue & booking count
    const [rev] = await conn.execute(`
      SELECT COALESCE(SUM(total_price), 0) AS totalRevenue,
             COUNT(*) AS bookingCount
      FROM bookings
      ${whereClause}
    `, params) as any[];

    // 2. Room stats (Active & Vacant today)
    const today = new Date().toISOString().split('T')[0];
    const [rooms] = await conn.execute(`
      SELECT 
        (SELECT COUNT(*) FROM rooms WHERE status = 'ACTIVE') AS totalRooms,
        (SELECT COUNT(*) FROM rooms r WHERE r.status = 'ACTIVE' AND r.room_id NOT IN (
          SELECT br.room_id FROM booking_rooms br
          JOIN bookings b ON b.booking_id = br.booking_id
          WHERE b.status NOT IN ('CANCELLED')
            AND br.check_in <= ? AND br.check_out > ?
        )) AS vacantRooms
    `, [today, today]) as any[];

    // 3. User stats
    const [users] = await conn.execute(`
      SELECT COUNT(*) AS userCount FROM users
    `) as any[];

    // 4. Recent bookings (latest 5)
    const [recent] = await conn.execute(`
      SELECT b.booking_id, b.status, b.total_price, b.created_at,
             u.full_name, rt.name AS room_type, r.room_number
      FROM bookings b
      LEFT JOIN users u          ON b.user_id = u.user_id
      LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
      LEFT JOIN rooms r          ON br.room_id = r.room_id
      LEFT JOIN room_types rt    ON r.type_id = rt.type_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `) as any[];

    res.json({
      totalRevenue: Number(rev[0].totalRevenue),
      bookingCount: Number(rev[0].bookingCount),
      totalRooms: Number(rooms[0].totalRooms),
      vacantRooms: Number(rooms[0].vacantRooms),
      userCount: Number(users[0].userCount),
      recentBookings: recent,
    });
  } finally {
    conn.release();
  }
});

// GET /api/stats/analytics (Admin - Biểu đồ & Thống kê sâu)
statsRouter.get('/analytics', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { start_date, end_date } = _req.query;
  console.log('--- [ADMIN ANALYTICS] ---', { start_date, end_date });
  const conn = await pool.getConnection();
  try {
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];

    // Tạo Where Clause cho filter theo thời gian
    let filterClause = "";
    const filterParams: any[] = [];
    if (start_date && end_date) {
      filterClause = " AND created_at BETWEEN ? AND ?";
      filterParams.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
    }

    // Một số bảng dùng trans_date hoặc date khác
    let filterPaymentClause = "";
    if (start_date && end_date) {
      filterPaymentClause = " AND transaction_date BETWEEN ? AND ?";
    }

    let filterMsgClause = "";
    if (start_date && end_date) {
      filterMsgClause = " AND sent_at BETWEEN ? AND ?";
    }

    // 1. Doanh thu 12 tháng (Thanh toán thành công) - Luôn hiển thị năm hiện tại để xem xu hướng
    const [revenueByMonth] = await conn.execute(`
      SELECT 
        MONTH(transaction_date) as month,
        SUM(amount) as total
      FROM payment_transactions
      WHERE status = 'SUCCESS' AND YEAR(transaction_date) = ?
      GROUP BY MONTH(transaction_date)
      ORDER BY month ASC
    `, [currentYear]) as any[];

    // 2. Tỷ lệ trạng thái Booking (Áp dụng Filter)
    const [bookingStatus] = await conn.execute(`
      SELECT status, COUNT(*) as count
      FROM bookings
      WHERE 1=1 ${filterClause.replace('created_at', 'created_at')}
      GROUP BY status
    `, filterParams) as any[];

    // 3. Top 5 loại phòng mang lại doanh thu cao nhất (Áp dụng Filter)
    const [topRooms] = await conn.execute(`
      SELECT rt.name, COALESCE(SUM(br.price), 0) as count
      FROM booking_rooms br
      JOIN rooms r ON br.room_id = r.room_id
      JOIN room_types rt ON r.type_id = rt.type_id
      JOIN bookings b ON b.booking_id = br.booking_id
      WHERE 1=1 ${filterClause.replace('created_at', 'b.created_at')}
      GROUP BY rt.type_id
      ORDER BY count DESC
      LIMIT 5
    `, filterParams) as any[];

    // 4. Tỷ lệ lấp đầy, Thống kê AI, Tăng trưởng & Khách mới
    const [misc] = await conn.execute(`
      SELECT 
        (SELECT COUNT(*) FROM rooms WHERE status = 'ACTIVE') as activeRooms,
        (SELECT COUNT(*) FROM room_inventory WHERE date = ? AND status = 'BOOKED') as occupiedRooms,
        (SELECT COUNT(*) FROM chatbot_messages WHERE sender = 'USER' ${filterMsgClause}) as userAiMessages,
        (SELECT COUNT(*) FROM chatbot_messages WHERE sender = 'BOT' ${filterMsgClause}) as botAiMessages,
        (SELECT COUNT(*) FROM users u 
         WHERE 1=1 ${filterClause.replace('created_at', 'u.created_at')}
         AND u.user_id NOT IN (
           SELECT ur.user_id FROM user_roles ur 
           JOIN roles r ON ur.role_id = r.role_id 
           WHERE r.role_name = 'ADMIN'
         )
        ) as newUsersToday,
        (SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = CURDATE()) as bookingsToday,
        (SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) as bookingsYesterday
      FROM DUAL
    `, [today, ...(start_date && end_date ? [start_date + ' 00:00:00', end_date + ' 23:59:59'] : []), ...(start_date && end_date ? [start_date + ' 00:00:00', end_date + ' 23:59:59'] : []), ...(start_date && end_date ? [start_date + ' 00:00:00', end_date + ' 23:59:59'] : [])]) as any[];

    const bToday = Number(misc[0].bookingsToday);
    const bYesterday = Number(misc[0].bookingsYesterday);
    const growth = bYesterday > 0 ? Math.round(((bToday - bYesterday) / bYesterday) * 100) : (bToday > 0 ? 100 : 0);

    res.json({
      success: true,
      data: {
        revenueByMonth: Array.from({ length: 12 }, (_, i) => {
          const monthData = revenueByMonth.find(m => m.month === i + 1);
          return { month: `T${i + 1}`, revenue: monthData ? Number(monthData.total) : 0 };
        }),
        bookingStatus: bookingStatus.map(s => {
          let name = s.status;
          if (name === 'PENDING') name = 'Chờ xử lý';
          if (name === 'CONFIRMED') name = 'Đã xác nhận';
          if (name === 'COMPLETED') name = 'Hoàn thành';
          if (name === 'CANCELLED') name = 'Đã hủy';
          return { name, value: Number(s.count) };
        }),
        topRoomTypes: topRooms.map(r => ({ name: r.name, value: Number(r.count) })),
        occupancy: {
          total: Number(misc[0].activeRooms),
          occupied: Number(misc[0].occupiedRooms),
          rate: misc[0].activeRooms > 0 ? Math.round((misc[0].occupiedRooms / misc[0].activeRooms) * 100) : 0
        },
        aiMessages: {
          user: Number(misc[0].userAiMessages),
          bot: Number(misc[0].botAiMessages),
          total: Number(misc[0].userAiMessages) + Number(misc[0].botAiMessages)
        },
        newUsersToday: Number(misc[0].newUsersToday),
        growth: growth
      }
    });
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    conn.release();
  }
});

// GET /api/stats/invoices (Admin - Quản lý hóa đơn)
statsRouter.get('/invoices', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const { start_date, end_date } = _req.query;
  const conn = await pool.getConnection();
  try {
    const params: any[] = [];
    let whereClause = "WHERE pt.status = 'SUCCESS'";
    
    if (start_date && end_date) {
      whereClause += " AND pt.transaction_date BETWEEN ? AND ?";
      params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
    }

    const [invoices] = await conn.execute(`
      SELECT 
        pt.payment_id,
        pt.booking_id,
        pt.amount,
        pt.method,
        pt.gateway,
        pt.transaction_date,
        pt.trans_id,
        u.full_name,
        u.email,
        b.total_price as booking_total
      FROM payment_transactions pt
      JOIN bookings b ON pt.booking_id = b.booking_id
      LEFT JOIN users u ON b.user_id = u.user_id
      ${whereClause}
      ORDER BY pt.transaction_date DESC
    `, params) as any[];

    const totalRevenue = invoices.reduce((acc: number, inv: any) => acc + Number(inv.amount), 0);

    res.json({
      success: true,
      data: {
        invoices,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Invoices Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    conn.release();
  }
});
