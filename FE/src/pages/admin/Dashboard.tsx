import React, { useState, useEffect, useCallback } from 'react';
import { Users, BedDouble, DollarSign, CalendarCheck, MoreVertical, Loader2, ArrowRight, Download } from 'lucide-react';
import { StatCard } from '../../components/features/StatCard';
import { StatusBadge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { statsApi, type ApiStats, type ListQuery } from '../../lib/api';
import { formatVND, formatDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const [stats, setStats]     = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState<ListQuery>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await statsApi.get(query);
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    if (!stats) return;
    const headers = ['Mã ĐP', 'Khách hàng', 'Phòng', 'Loại phòng', 'Ngày đặt', 'Trạng thái', 'Tổng tiền'];
    const rows = stats.recentBookings.map(b => [
      `#${b.booking_id}`,
      b.full_name || 'Khách vãng lai',
      b.room_number,
      b.room_type,
      formatDate(b.created_at),
      b.status,
      b.total_price
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  const statCards = [
    { label: 'Tổng doanh thu', value: formatVND(stats?.totalRevenue ?? 0), trend: query.start_date ? 'Trong kỳ' : 'Tất cả', trendUp: true, iconBg: 'bg-blue-100 text-blue-600', icon: <DollarSign className="h-5 w-5" /> },
    { label: 'Lượt đặt phòng', value: String(stats?.bookingCount ?? 0), trend: query.start_date ? 'Trong kỳ' : 'Tất cả', trendUp: true, iconBg: 'bg-indigo-100 text-indigo-600', icon: <CalendarCheck className="h-5 w-5" /> },
    { label: 'Phòng trống', value: `${stats?.vacantRooms ?? 0}/${stats?.totalRooms ?? 0}`, iconBg: 'bg-orange-100 text-orange-600', icon: <BedDouble className="h-5 w-5" /> },
    { label: 'Số khách đăng ký', value: String(stats?.userCount ?? 0), iconBg: 'bg-emerald-100 text-emerald-600', icon: <Users className="h-5 w-5" /> },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {query.start_date && query.end_date 
              ? `Thống kê từ ${formatDate(query.start_date)} đến ${formatDate(query.end_date)}`
              : 'Tổng quan tình hình hoạt động của khách sạn.'}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <DateRangeFilter onFilter={(start, end) => setQuery({ start_date: start, end_date: end })} />
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Recent bookings */}
      <Card padding={false}>
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/20">
          <h2 className="font-bold text-gray-900">Đặt phòng gần đây</h2>
          <Link to="/admin/bookings" className="text-sm text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 group">
            Xem tất cả <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider font-bold">
                {['Mã ĐP', 'Khách hàng', 'Phòng', 'Ngày đặt', 'Trạng thái', 'Tổng tiền', ''].map((h) => (
                  <th key={h} className="px-5 py-4 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(stats?.recentBookings ?? []).length > 0 ? stats?.recentBookings.map((b) => (
                <tr key={b.booking_id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-4 text-sm font-bold text-gray-900">#{b.booking_id}</td>
                  <td className="px-5 py-4 text-sm text-gray-600 font-medium">{b.full_name || 'Khách vãng lai'}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    <span className="font-bold text-gray-900">Phòng {b.room_number}</span>
                    <p className="text-xs text-gray-400">{b.room_type}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{formatDate(b.created_at)}</td>
                  <td className="px-5 py-4"><StatusBadge status={b.status.toLowerCase() as any} /></td>
                  <td className="px-5 py-4 text-sm font-black text-gray-900">{formatVND(b.total_price)}</td>
                  <td className="px-5 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-100 shadow-none hover:shadow-sm transition-all" aria-label="Tùy chọn">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-gray-400 font-medium">
                    Không có đơn đặt phòng nào mới.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
};
