import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Info, Check, X, Clock, AlertCircle, Download, Trash2, Calendar } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { bookingApi, type ApiBooking, type ListQuery } from '../../lib/api';
import { formatVND, formatDate } from '../../lib/utils';
import type { BookingStatus } from '../../types';

const STATUS_TABS: { label: string; value: BookingStatus | 'all' }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đã xác nhận', value: 'confirmed' },
  { label: 'Chờ xử lý', value: 'pending' },
  { label: 'Hoàn thành', value: 'completed' },
  { label: 'Đã hủy', value: 'cancelled' },
];

export const AdminBookings: React.FC = () => {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<BookingStatus | 'all'>('all');
  const [search, setSearch]     = useState('');
  const [query, setQuery]       = useState<ListQuery>({});
  const [selected, setSelected] = useState<ApiBooking | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bookingApi.list(query);
      setBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: number, status: string) => {
    setUpdating(id);
    try {
      await bookingApi.updateStatus(id, status);
      await load(); 
      if (selected?.booking_id === id) {
        const fresh = await bookingApi.detail(id);
        setSelected(fresh);
      }
    } catch (e: any) {
      alert(e.message ?? 'Cập nhật thất bại');
    } finally {
      setUpdating(null);
    }
  };

  const handleHardDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đặt phòng này? Thao tác này không thể hoàn tác.')) return;
    try {
      await bookingApi.hardRemove(id);
      setBookings(bookings.filter(b => b.booking_id !== id));
      if (selected?.booking_id === id) setSelected(null);
    } catch (e: any) {
      alert(e.message || 'Xóa thất bại');
    }
  };

  const handleExport = () => {
    const headers = ['Mã ĐP', 'Khách hàng', 'Phòng', 'Loại phòng', 'Ngày đặt', 'Check-in', 'Check-out', 'Trạng thái', 'Tổng tiền'];
    const rows = bookings.map(b => [
      `#${b.booking_id}`,
      b.full_name || 'Khách vãng lai',
      b.room_number,
      b.room_type,
      formatDate(b.created_at),
      formatDate(b.check_in),
      formatDate(b.check_out),
      b.status,
      b.total_price
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bookings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openDetail = async (id: number) => {
    try {
      const data = await bookingApi.detail(id);
      setSelected(data);
    } catch (e: any) {
      alert('Không thể tải chi tiết');
    }
  };

  const filtered = bookings
    .filter((b) => tab === 'all' || b.status.toLowerCase() === tab.toLowerCase())
    .filter((b) =>
      (b.full_name?.toLowerCase() ?? '').includes(search.toLowerCase()) ||
      String(b.booking_id).includes(search) ||
      b.room_number?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Quản lý đặt phòng</h1>
          <p className="text-sm text-gray-500">Theo dõi và quản lý mọi giao dịch đặt phòng.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <DateRangeFilter onFilter={(start, end) => setQuery({ start_date: start, end_date: end })} />
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Xuất CSV</span>
          </button>
        </div>
      </div>

      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between bg-gray-50/10">
          <div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-fit overflow-x-auto max-w-full">
            {STATUS_TABS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  tab === value 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm khách hàng, số phòng, mã ĐP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24 text-gray-400 flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-300" />
              </div>
            </div>
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Đang tải đơn đặt phòng...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider font-bold">
                  {['Mã ĐP', 'Khách hàng', 'Phòng', 'Ngày nhận/trả', 'Trạng thái', 'Tổng tiền', 'Thao tác'].map((h) => (
                    <th key={h} className="px-5 py-4 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length > 0 ? filtered.map((b) => (
                  <tr key={b.booking_id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-5 py-5 text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">#{b.booking_id}</td>
                    <td className="px-5 py-5">
                      <div className="font-bold text-gray-900 text-sm">{b.full_name || 'Khách vãng lai'}</div>
                      <div className="text-xs text-gray-400 font-medium">{b.email}</div>
                    </td>
                    <td className="px-5 py-5 text-sm">
                      <div className="font-bold text-gray-700">Phòng {b.room_number}</div>
                      <div className="text-xs text-gray-400 font-medium">{b.room_type}</div>
                    </td>
                    <td className="px-5 py-5 text-sm text-gray-600">
                      <div className="flex items-center text-blue-600 font-bold mb-0.5">
                        <Clock className="h-3.5 w-3.5 mr-1 text-gray-400" /> {formatDate(b.check_in)}
                      </div>
                      <div className="text-xs text-gray-400 font-medium ml-4.5">Tới {formatDate(b.check_out)}</div>
                    </td>
                    <td className="px-5 py-5">
                      <StatusBadge status={b.status.toLowerCase() as any} className="font-bold px-3 py-1" />
                    </td>
                    <td className="px-5 py-5 text-sm font-black text-gray-900">{formatVND(b.total_price)}</td>
                    <td className="px-5 py-5 text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(b.booking_id)} className="rounded-xl hover:bg-white border hover:border-gray-200">Chi tiết</Button>
                        <button 
                          onClick={() => handleHardDelete(b.booking_id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center text-sm text-gray-400 font-medium">
                      Không tìm thấy đơn đặt phòng nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                 <h3 className="text-xl font-black text-gray-900 tracking-tight">Chi tiết đơn đặt # {selected.booking_id}</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Giao dịch được tạo lúc {formatDate(selected.created_at)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2.5 bg-white hover:bg-gray-100 rounded-2xl transition-all shadow-sm">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-8 max-h-[65vh] overflow-y-auto space-y-10 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <section>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5 flex items-center">
                    <Info className="h-3.5 w-3.5 mr-2 text-blue-500" /> Thông tin khách hàng
                  </h4>
                  <div className="space-y-4 bg-gray-50/50 p-5 rounded-[24px] border border-gray-100">
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Họ tên</div>
                      <div className="text-sm font-black text-gray-800">{selected.full_name || 'Khách vãng lai'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Email</div>
                      <div className="text-sm font-bold text-gray-600">{selected.email || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Số điện thoại</div>
                      <div className="text-sm font-bold text-gray-600">{selected.phone || 'N/A'}</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-5 flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-2 text-blue-500" /> Thông tin lưu trú
                  </h4>
                  <div className="space-y-4 bg-gray-50/50 p-5 rounded-[24px] border border-gray-100">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Nhận phòng</div>
                        <div className="text-sm font-black text-blue-600 tracking-tight">{formatDate(selected.check_in)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Trả phòng</div>
                        <div className="text-sm font-black text-blue-600 tracking-tight">{formatDate(selected.check_out)}</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200/50">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Loại phòng / Số phòng</div>
                      <div className="text-sm font-black text-gray-800">{selected.room_type} - <span className="text-blue-500">Phòng {selected.room_number}</span></div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Trạng thái xử lý</div>
                  <StatusBadge status={selected.status.toLowerCase() as any} className="px-4 py-2 text-xs font-black" />
                </div>
                <div className="flex gap-2">
                  {selected.status === 'PENDING' && (
                    <>
                      <Button variant="ghost" className="rounded-2xl h-12 px-6 font-bold text-red-500 hover:bg-red-50" onClick={() => handleStatus(selected.booking_id, 'CANCELLED')} disabled={updating === selected.booking_id}>Từ chối</Button>
                      <Button className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-blue-100" onClick={() => handleStatus(selected.booking_id, 'CONFIRMED')} disabled={updating === selected.booking_id}>Duyệt đơn</Button>
                    </>
                  )}
                  {selected.status === 'CONFIRMED' && (
                    <Button className="rounded-2xl h-12 px-6 font-black shadow-lg shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatus(selected.booking_id, 'COMPLETED')} disabled={updating === selected.booking_id}>Hoàn thành / Trả phòng</Button>
                  )}
                  {selected.status === 'COMPLETED' && (
                    <div className="text-xs text-emerald-600 font-black bg-emerald-50 px-5 py-3 rounded-2xl flex items-center border border-emerald-100">
                      <Check className="h-4 w-4 mr-2" /> Giao dịch hoàn tất
                    </div>
                  )}
                  {selected.status === 'CANCELLED' && (
                    <div className="text-xs text-red-600 font-black bg-red-50 px-5 py-3 rounded-2xl flex items-center border border-red-100">
                      <AlertCircle className="h-4 w-4 mr-2" /> Đơn đặt đã bị hủy
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-950 flex justify-between items-center">
              <div>
                 <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Tổng cộng thanh toán</span>
                 <span className="text-xs text-gray-400 font-bold">(Đã bao gồm VAT & phí dịch vụ)</span>
              </div>
              <span className="text-3xl font-black text-blue-400 tracking-tighter">{formatVND(selected.total_price)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
