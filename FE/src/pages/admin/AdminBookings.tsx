import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader2, Check, X, Clock, AlertCircle, Download,
  Trash2, Calendar, Users, CreditCard, ChevronRight, Receipt,
  BedDouble, Maximize2, FileText, Printer,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { bookingApi, type ApiBooking, type ListQuery } from '../../lib/api';
import { formatVND, formatDate, formatTime } from '../../lib/utils';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  PENDING:   { label: 'Chờ xử lý',   badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
  CONFIRMED: { label: 'Đã xác nhận', badge: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-400'   },
  COMPLETED: { label: 'Hoàn thành',  badge: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-400'  },
  CANCELLED: { label: 'Đã hủy',      badge: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-400'    },
} as const;

type StatusKey = keyof typeof STATUS_CFG;

const TABS: { label: string; value: StatusKey | 'ALL' }[] = [
  { label: 'Tất cả',      value: 'ALL'       },
  { label: 'Chờ xử lý',  value: 'PENDING'   },
  { label: 'Đã xác nhận',value: 'CONFIRMED' },
  { label: 'Hoàn thành', value: 'COMPLETED' },
  { label: 'Đã hủy',     value: 'CANCELLED' },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as StatusKey] ?? STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// Mirror backend fee logic
function calcEarlyFeeDisplay(time: string | null | undefined, basePerNight: number): number {
  if (!time) return 0;
  const h = parseInt(time.split(':')[0], 10);
  if (h >= 5  && h < 9)  return Math.round(basePerNight * 0.5);
  if (h >= 9  && h < 14) return Math.round(basePerNight * 0.3);
  return 0;
}

function calcLateFeeDisplay(time: string | null | undefined, basePerNight: number): number {
  if (!time) return 0;
  const h = parseInt(time.split(':')[0], 10);
  if (h >= 12 && h < 15) return Math.round(basePerNight * 0.3);
  if (h >= 15 && h < 18) return Math.round(basePerNight * 0.5);
  if (h >= 18)           return Math.round(basePerNight * 1.0);
  return 0;
}

export const AdminBookings: React.FC = () => {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [dailyPlan, setDailyPlan] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<StatusKey | 'ALL' | 'DAILY'>('ALL');
  const [search, setSearch]     = useState('');
  const [query, setQuery]       = useState<ListQuery>({});
  const [selected, setSelected] = useState<ApiBooking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, daily] = await Promise.all([
        bookingApi.list(query),
        bookingApi.getDailyPlan().catch(() => []),
      ]);
      setBookings(all);
      setDailyPlan(daily);
    } catch (e: any) {
      console.error(e.message);
    } finally { setLoading(false); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      setSelected(await bookingApi.detail(id));
    } catch (e: any) { alert(e.message ?? 'Không thể tải chi tiết'); }
    finally { setDetailLoading(false); }
  };

  const handleStatus = async (id: number, status: string) => {
    setUpdating(true);
    try {
      await bookingApi.updateStatus(id, status);
      await load();
      if (selected?.booking_id === id) setSelected(await bookingApi.detail(id));
    } catch (e: any) { alert(e.message ?? 'Cập nhật thất bại'); }
    finally { setUpdating(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa vĩnh viễn đặt phòng này?')) return;
    try {
      await bookingApi.hardRemove(id);
      setBookings((p) => p.filter((b) => b.booking_id !== id));
      if (selected?.booking_id === id) setSelected(null);
    } catch (e: any) { alert(e.message ?? 'Xóa thất bại'); }
  };

  // In hoá đơn — mở cửa sổ in với nội dung HTML
  const printInvoice = (b: ApiBooking) => {
    const nights = b.check_in && b.check_out
      ? Math.max(1, Math.floor((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
      : 1;
    const roomPrice    = b.room_price ?? 0;
    const pricePerNight = nights > 0 ? Math.round(roomPrice / nights) : roomPrice;
    const earlyFee     = calcEarlyFeeDisplay(b.check_in_time, pricePerNight);
    const lateFee      = calcLateFeeDisplay(b.check_out_time, pricePerNight);
    const subtotal     = roomPrice + earlyFee + lateFee;
    const svcFee       = Math.round(subtotal * 0.05);
    const vat          = Math.round(subtotal * 0.10);

    const statusLabel: Record<string, string> = {
      PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận',
      COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
    };

    const html = `<!DOCTYPE html><html lang="vi"><head>
      <meta charset="UTF-8"/>
      <title>Hoá đơn #${b.booking_id}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; color: #111; padding: 40px; max-width: 600px; margin: auto; }
        .header { text-align: center; margin-bottom: 28px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #1d4ed8; }
        .header p  { font-size: 12px; color: #6b7280; margin-top: 4px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
          background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; margin-top: 6px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
          color: #9ca3af; margin-bottom: 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
        .box p { font-size: 12px; color: #374151; line-height: 1.6; }
        .box .label { font-size: 10px; color: #9ca3af; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        tr.row td { padding: 7px 0; border-bottom: 1px dashed #e5e7eb; }
        tr.row td:last-child { text-align: right; font-weight: 500; }
        tr.fee td { color: #2563eb; }
        tr.total td { font-size: 15px; font-weight: 700; padding-top: 10px; border-top: 2px solid #111; }
        tr.total td:last-child { color: #1d4ed8; }
        .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="header">
        <h1>SmartHotel</h1>
        <p>Hoá đơn đặt phòng</p>
        <span class="badge">${statusLabel[b.status] ?? b.status}</span>
      </div>

      <div class="section">
        <div class="grid2">
          <div class="box">
            <p class="label">Mã đặt phòng</p>
            <p><strong>#${b.booking_id}</strong></p>
            <p class="label" style="margin-top:6px">Ngày đặt</p>
            <p>${formatDate(b.created_at)}</p>
          </div>
          <div class="box">
            <p class="label">Khách hàng</p>
            <p><strong>${b.full_name ?? 'Khách vãng lai'}</strong></p>
            ${b.phone ? `<p>${b.phone}</p>` : ''}
            ${b.email ? `<p>${b.email}</p>` : ''}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="box">
          <p class="label">Phòng</p>
          <p><strong>Phòng ${b.room_number} — ${b.room_type}</strong></p>
          <p style="margin-top:4px">
            Nhận: <strong>${formatDate(b.check_in)}${b.check_in_time ? ' lúc ' + formatTime(b.check_in_time) : ''}</strong>
            &nbsp;→&nbsp;
            Trả: <strong>${formatDate(b.check_out)}${b.check_out_time ? ' lúc ' + formatTime(b.check_out_time) : ''}</strong>
            &nbsp;(${nights} đêm)
          </p>
        </div>
      </div>

      <div class="section">
        <p class="section-title">Chi tiết hoá đơn</p>
        <table>
          <tr class="row"><td>Giá phòng (${nights} đêm × ${formatVND(pricePerNight)})</td><td>${formatVND(roomPrice)}</td></tr>
          ${earlyFee > 0 ? `<tr class="row fee"><td>Nhận phòng sớm (${formatTime(b.check_in_time)})</td><td>+${formatVND(earlyFee)}</td></tr>` : ''}
          ${lateFee  > 0 ? `<tr class="row fee"><td>Trả phòng muộn (${formatTime(b.check_out_time)})</td><td>+${formatVND(lateFee)}</td></tr>` : ''}
          <tr class="row"><td style="color:#6b7280">Phí dịch vụ (5%)</td><td style="color:#6b7280">${formatVND(svcFee)}</td></tr>
          <tr class="row"><td style="color:#6b7280">Thuế VAT (10%)</td><td style="color:#6b7280">${formatVND(vat)}</td></tr>
          <tr class="total"><td>Tổng cộng</td><td>${formatVND(b.total_price)}</td></tr>
        </table>
      </div>

      ${b.payments && b.payments.length > 0 ? `
      <div class="section">
        <p class="section-title">Thanh toán</p>
        <table>
          ${b.payments.map((p) => `
            <tr class="row">
              <td>${p.method} — <span style="color:${p.status === 'SUCCESS' ? '#16a34a' : p.status === 'FAILED' ? '#dc2626' : '#d97706'}">${p.status}</span></td>
              <td>${formatVND(p.amount)}</td>
            </tr>
          `).join('')}
        </table>
      </div>` : ''}

      <div class="footer">
        <p>Cảm ơn quý khách đã lựa chọn SmartHotel!</p>
        <p style="margin-top:4px">In lúc ${new Date().toLocaleString('vi-VN')}</p>
      </div>
    </body></html>`;

    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExport = () => {
    const rows = bookings.map((b) => [
      `#${b.booking_id}`, b.full_name ?? '', b.room_number ?? '',
      b.room_type ?? '', formatDate(b.created_at), formatDate(b.check_in),
      formatDate(b.check_out), b.status, b.total_price,
    ]);
    const csv = [['Mã ĐP','Khách','Phòng','Loại','Ngày đặt','Check-in','Check-out','Trạng thái','Tổng tiền'], ...rows]
      .map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const displayList = tab === 'DAILY' ? dailyPlan : bookings.filter((b) => tab === 'ALL' || b.status === tab);

  const filtered = displayList
    .filter((b) =>
      (b.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(b.booking_id).includes(search) ||
      (b.room_number ?? '').toLowerCase().includes(search.toLowerCase())
    );

  // Stats
  const stats = Object.keys(STATUS_CFG).reduce((acc, k) => {
    acc[k] = bookings.filter((b) => b.status === k).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý đặt phòng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi và xử lý mọi giao dịch đặt phòng</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter onFilter={(s, e) => setQuery({ start_date: s, end_date: e })} />
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {(Object.entries(STATUS_CFG) as [StatusKey, typeof STATUS_CFG[StatusKey]][]).map(([key, cfg]) => (
          <button key={key}
            onClick={() => setTab(tab === key ? 'ALL' : key)}
            className={`bg-white rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all text-left
              ${tab === key ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}>
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <div>
              <p className="text-xs text-gray-400">{cfg.label}</p>
              <p className="text-xl font-bold text-gray-900">{stats[key] ?? 0}</p>
            </div>
          </button>
        ))}
      </div>

      <Card padding={false}>
        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {TABS.map(({ label, value }) => (
              <button key={value} onClick={() => setTab(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                  ${tab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
                {value !== 'ALL' && <span className="ml-1.5 text-gray-400">{stats[value] ?? 0}</span>}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Tìm khách, số phòng, mã ĐP..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-64" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">Không tìm thấy đặt phòng nào</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Mã ĐP</th>
                <th className="px-5 py-3">Khách hàng</th>
                <th className="px-5 py-3">Phòng</th>
                <th className="px-5 py-3">Check-in / out</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Tổng tiền</th>
                <th className="px-5 py-3">Thao tác nhanh</th>
                <th className="px-5 py-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.booking_id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-4 text-sm font-bold text-gray-900">#{b.booking_id}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">{b.full_name ?? 'Khách vãng lai'}</p>
                    <p className="text-xs text-gray-400">{b.email ?? ''}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-800">Phòng {b.room_number}</p>
                    <p className="text-xs text-gray-400">{b.room_type}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1 text-blue-600 font-medium">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {formatDate(b.check_in)}
                      {b.check_in_time && <span className="text-xs text-gray-400 ml-1">{formatTime(b.check_in_time)}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 ml-5">
                      → {formatDate(b.check_out)}
                      {b.check_out_time && <span className="ml-1">{formatTime(b.check_out_time)}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-900">{formatVND(b.total_price)}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      {b.status === 'CONFIRMED' && b.room_status !== 'MAINTENANCE' && (
                        <button onClick={() => handleAdminCheckIn(b.booking_id)}
                          className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">
                          Nhận phòng
                        </button>
                      )}
                      {b.status === 'CONFIRMED' && b.room_status === 'MAINTENANCE' && (
                        <button onClick={() => handleAdminCheckOut(b.booking_id)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors">
                          Trả phòng
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openDetail(b.booking_id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Detail Modal */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>

            {detailLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
            ) : selected && (
              <>
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <p className="text-lg font-bold text-gray-900">Đặt phòng #{selected.booking_id}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Tạo lúc {formatDate(selected.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selected.status} />
                    <button onClick={() => setSelected(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Modal body */}
                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                  {/* Khách hàng + Phòng */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Khách hàng</p>
                      <p className="text-sm font-bold text-gray-900">{selected.full_name ?? 'Khách vãng lai'}</p>
                      {selected.email && <p className="text-xs text-gray-500">{selected.email}</p>}
                      {selected.phone && <p className="text-xs text-gray-500">{selected.phone}</p>}
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Lưu trú</p>
                      <p className="text-sm font-bold text-gray-900">Phòng {selected.room_number} — {selected.room_type}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(selected.check_in)}
                        {selected.check_in_time && <span className="text-blue-600">{formatTime(selected.check_in_time)}</span>}
                        {' → '}
                        {formatDate(selected.check_out)}
                        {selected.check_out_time && <span className="text-blue-600">{formatTime(selected.check_out_time)}</span>}
                      </div>
                      {(() => {
                        const nights = selected.check_in && selected.check_out
                          ? Math.max(1, Math.floor((new Date(selected.check_out).getTime() - new Date(selected.check_in).getTime()) / 86400000))
                          : null;
                        return nights ? <p className="text-xs text-gray-400">{nights} đêm</p> : null;
                      })()}
                    </div>
                  </div>

                  {/* ── HOÁ ĐƠN CHI TIẾT ── */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Header hoá đơn */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 border-b border-gray-200">
                      <Receipt className="h-4 w-4 text-gray-500" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Hoá đơn chi tiết</p>
                    </div>

                    <div className="p-4 space-y-2 text-sm">
                      {/* Giá phòng */}
                      {(() => {
                        const roomPrice = selected.room_price ?? 0;
                        const nights = selected.check_in && selected.check_out
                          ? Math.max(1, Math.floor((new Date(selected.check_out).getTime() - new Date(selected.check_in).getTime()) / 86400000))
                          : 1;
                        const pricePerNight = nights > 0 ? Math.round(roomPrice / nights) : roomPrice;

                        // Tính phí sớm/muộn từ check_in_time / check_out_time
                        const earlyFee = calcEarlyFeeDisplay(selected.check_in_time, pricePerNight);
                        const lateFee  = calcLateFeeDisplay(selected.check_out_time, pricePerNight);

                        // Tổng trước thuế = room_price + early + late
                        const subtotal = roomPrice + earlyFee + lateFee;
                        const vat      = Math.round(subtotal * 0.10);
                        const svcFee   = Math.round(subtotal * 0.05);

                        return (
                          <>
                            <div className="flex justify-between text-gray-700">
                              <span>Giá phòng ({nights} đêm × {formatVND(pricePerNight)})</span>
                              <span className="font-medium">{formatVND(roomPrice)}</span>
                            </div>

                            {earlyFee > 0 && (
                              <div className="flex justify-between text-blue-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Nhận phòng sớm ({formatTime(selected.check_in_time)})
                                </span>
                                <span>+{formatVND(earlyFee)}</span>
                              </div>
                            )}

                            {lateFee > 0 && (
                              <div className="flex justify-between text-blue-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  Trả phòng muộn ({formatTime(selected.check_out_time)})
                                </span>
                                <span>+{formatVND(lateFee)}</span>
                              </div>
                            )}

                            <div className="flex justify-between text-gray-500 text-xs border-t border-dashed border-gray-200 pt-2 mt-1">
                              <span>Phí dịch vụ (5%)</span>
                              <span>{formatVND(svcFee)}</span>
                            </div>
                            <div className="flex justify-between text-gray-500 text-xs">
                              <span>Thuế VAT (10%)</span>
                              <span>{formatVND(vat)}</span>
                            </div>

                            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1 text-base">
                              <span>Tổng cộng</span>
                              <span className="text-blue-600">{formatVND(selected.total_price)}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Guests */}
                  {selected.guests && selected.guests.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Danh sách khách ({selected.guests.length})
                      </p>
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        {selected.guests.map((g, i) => (
                          <div key={g.booking_guest_id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                            <span className="font-medium text-gray-800">{g.full_name}</span>
                            <span className="text-xs text-gray-400">{g.phone ?? g.email ?? ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payments */}
                  {selected.payments && selected.payments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" /> Giao dịch thanh toán
                      </p>
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        {selected.payments.map((p, i) => (
                          <div key={p.payment_id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{p.method}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                                ${p.status === 'SUCCESS' ? 'bg-green-50 text-green-700 border-green-200' :
                                  p.status === 'FAILED'  ? 'bg-red-50 text-red-700 border-red-200' :
                                                           'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                {p.status}
                              </span>
                              <span className="text-xs text-gray-400">{formatDate(p.transaction_date)}</span>
                            </div>
                            <span className="font-bold text-gray-900">{formatVND(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                  <div>
                    <p className="text-xs text-gray-400">Tổng thanh toán</p>
                    <p className="text-xl font-bold text-gray-900">{formatVND(selected.total_price)}</p>
                  </div>
                  <div className="flex gap-2">
                    {/* Nút in hoá đơn */}
                    <button
                      onClick={() => printInvoice(selected)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-white transition-colors"
                    >
                      <Printer className="h-4 w-4" /> In hoá đơn
                    </button>

                    {selected.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleStatus(selected.booking_id, 'CANCELLED')} disabled={updating}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50">
                          <X className="h-4 w-4" /> Từ chối
                        </button>
                        <button onClick={() => handleStatus(selected.booking_id, 'CONFIRMED')} disabled={updating}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
                          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Duyệt đơn
                        </button>
                      </>
                    )}
                    {selected.status === 'CONFIRMED' && (
                      <button onClick={() => handleStatus(selected.booking_id, 'COMPLETED')} disabled={updating}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
                        {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Hoàn thành / Trả phòng
                      </button>
                    )}
                    {selected.status === 'COMPLETED' && (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-200">
                        <Check className="h-4 w-4" /> Giao dịch hoàn tất
                      </span>
                    )}
                    {selected.status === 'CANCELLED' && (
                      <span className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl border border-red-200">
                        <AlertCircle className="h-4 w-4" /> Đã hủy
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Check-out Result Modal */}
      {checkoutResult && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-green-600 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Trả phòng thành công</h3>
                <p className="text-xs text-gray-500">Phòng đã được chuyển sang trạng thái chờ dọn dẹp</p>
              </div>
            </div>
            
            <div className="space-y-3 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Phụ phí phát sinh:</span>
                <span className="font-bold text-blue-600">+{formatVND(checkoutResult.extraFee)}</span>
              </div>
              <p className="text-[10px] text-gray-400 italic text-right">{checkoutResult.description}</p>
              
              <div className="flex justify-between text-lg font-black border-t border-dashed border-gray-200 pt-3 mt-1">
                <span className="text-gray-900">TỔNG THANH TOÁN:</span>
                <span className="text-blue-700">{formatVND(checkoutResult.totalFinal)}</span>
              </div>
            </div>

            <Button fullWidth variant="primary" onClick={() => setCheckoutResult(null)}>Xác nhận & Đóng</Button>
          </Card>
        </div>
      )}
    </>
  );
};
