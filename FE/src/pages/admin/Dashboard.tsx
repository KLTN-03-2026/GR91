import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, BedDouble, DollarSign, CalendarCheck, 
  MoreVertical, Loader2, ArrowRight, Download, 
  TrendingUp, MessageSquare, UserPlus, Bot,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { StatCard } from '../../components/features/StatCard';
import { StatusBadge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { statsApi, type ApiStats, type AnalyticsData, type ListQuery } from '../../lib/api';
import { formatVND, formatDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<ListQuery>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        statsApi.get(query),
        statsApi.getAnalytics(query)
      ]);
      setStats(statsRes);
      if (analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

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
    { 
      label: 'Doanh thu năm nay', 
      value: formatVND(analytics?.revenueByMonth.reduce((acc, m) => acc + m.revenue, 0) ?? 0), 
      trend: 'Tiền thực thu', 
      trendUp: true, 
      iconBg: 'bg-blue-100 text-blue-600', 
      icon: <DollarSign className="h-5 w-5" /> 
    },
    { 
      label: 'Tỷ lệ lấp đầy', 
      value: `${analytics?.occupancy.rate ?? 0}%`, 
      trend: `${analytics?.occupancy.occupied}/${analytics?.occupancy.total} phòng bận`, 
      trendUp: (analytics?.occupancy.rate ?? 0) > 50, 
      iconBg: 'bg-orange-100 text-orange-600', 
      icon: <TrendingUp className="h-5 w-5" /> 
    },
    { 
      label: 'Đơn đặt phòng mới', 
      value: String(stats?.bookingCount ?? 0), 
      trend: (
        <div className={`flex items-center gap-1 font-bold ${analytics && analytics.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {analytics && analytics.growth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(analytics?.growth ?? 0)}% so với hôm qua
        </div>
      ), 
      trendUp: (analytics?.growth ?? 0) >= 0, 
      iconBg: 'bg-emerald-100 text-emerald-600', 
      icon: <CalendarCheck className="h-5 w-5" /> 
    },
    { 
      label: 'Trợ lý AI Concierge', 
      value: String(analytics?.aiMessages.total ?? 0), 
      trend: `Hỗ trợ ${analytics?.aiMessages.user} yêu cầu`, 
      trendUp: true, 
      iconBg: 'bg-purple-100 text-purple-600', 
      icon: <Bot className="h-5 w-5" /> 
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Trung tâm điều hành Admin
            <div className="flex items-center gap-1.5 ml-3 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Trực tuyến</span>
            </div>
          </h1>
          <p className="text-sm text-gray-500">
            Dữ liệu cập nhật tự động · {lastUpdated.toLocaleTimeString('vi-VN')}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <DateRangeFilter onFilter={(start, end) => setQuery({ start_date: start, end_date: end })} />
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Xuất Báo Cáo</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((s) => (
          <motion.div key={s.label} variants={itemVariants}>
            <StatCard {...s} />
          </motion.div>
        ))}
      </div>

      {/* New Customers & AI Highlights Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <UserPlus size={24} />
             </div>
             <div>
                <p className="text-sm text-gray-500 font-medium">Khách hàng mới hôm nay</p>
                <h4 className="text-xl font-bold text-gray-900">{analytics?.newUsersToday} thành viên</h4>
             </div>
           </div>
           <div className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold">
             +100%
           </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-purple-600 p-4 rounded-2xl text-white flex items-center justify-between shadow-lg relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Bot size={80} />
           </div>
           <div className="flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <MessageSquare size={24} />
             </div>
             <div>
                <p className="text-sm text-purple-100 font-medium">AI Performance</p>
                <h4 className="text-xl font-bold">Tỷ lệ giải đáp 100%</h4>
             </div>
           </div>
           <div className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-bold relative z-10">
             Thông minh
           </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card padding={false} className="h-full border-none shadow-sm">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900">Biểu đồ Doanh thu</h3>
                <p className="text-xs text-gray-400">Dữ liệu tài chính theo từng tháng (VND)</p>
              </div>
            </div>
            <div className="p-6 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.revenueByMonth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickFormatter={(val) => `${val / 1000000}M`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [formatVND(val), 'Doanh thu']}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Booking Status Chart */}
        <motion.div variants={itemVariants}>
          <Card padding={false} className="h-full border-none shadow-sm">
            <div className="p-6 border-b border-gray-50">
              <h3 className="font-bold text-gray-900">Tình trạng đơn hàng</h3>
              <p className="text-xs text-gray-400">Phân bổ theo trạng thái thực tế</p>
            </div>
            <div className="p-6 h-[350px] flex flex-col items-center justify-center">
              {(analytics?.bookingStatus ?? []).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics?.bookingStatus ?? []}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {(analytics?.bookingStatus ?? []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-gray-400 text-sm">Không có đơn hàng trong khoảng này</div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row: Top Room Types & Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Room Types */}
        <motion.div variants={itemVariants}>
          <Card padding={false} className="border-none shadow-sm h-full">
            <div className="p-6 border-b border-gray-50">
              <h3 className="font-bold text-gray-900">Hạng phòng được ưa chuộng</h3>
              <p className="text-xs text-gray-400">Xếp hạng theo lượt đặt phòng</p>
            </div>
            <div className="p-6 space-y-6">
              {(analytics?.topRoomTypes ?? []).length > 0 ? (analytics?.topRoomTypes ?? []).map((room, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-gray-700">{room.name}</span>
                    <span className="text-blue-600 font-black">{room.value} Đơn</span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(room.value / (analytics?.topRoomTypes[0]?.value || 1)) * 100}%` }}
                      transition={{ duration: 1.5, ease: 'circOut' }}
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                    />
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-gray-400 text-sm">Không có dữ liệu trong khoảng này</div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Recent Bookings (Mini Table) */}
        <motion.div variants={itemVariants}>
          <Card padding={false} className="border-none shadow-sm overflow-hidden h-full">
            <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-gray-50/20">
              <h2 className="font-bold text-gray-900">Giao dịch mới nhất</h2>
              <Link to="/admin/bookings" className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 group">
                Xem chi tiết <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Mã</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Phòng</th>
                    <th className="px-6 py-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(stats?.recentBookings ?? []).map((b) => (
                    <tr key={b.booking_id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-gray-900">#{b.booking_id}</td>
                      <td className="px-6 py-4 text-xs text-gray-600 truncate max-w-[120px]">{b.full_name}</td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-600">{b.room_number}</td>
                      <td className="px-6 py-4"><StatusBadge status={b.status.toLowerCase() as any} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};
