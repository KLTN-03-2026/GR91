import React from 'react';
import { Users, BedDouble, DollarSign, CalendarCheck, MoreVertical } from 'lucide-react';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { StatCard } from '../components/features/StatCard';
import { StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { MOCK_ADMIN_BOOKINGS } from '../data/mock';
import { formatVND } from '../lib/utils';

const STATS = [
  { label: 'Tổng doanh thu', value: '124.500.000đ', trend: '+12.5%', trendUp: true, iconBg: 'bg-blue-50 text-blue-600', icon: <DollarSign className="h-5 w-5" /> },
  { label: 'Lượt đặt phòng', value: '145', trend: '+5.2%', trendUp: true, iconBg: 'bg-indigo-50 text-indigo-600', icon: <CalendarCheck className="h-5 w-5" /> },
  { label: 'Phòng trống', value: '24/120', iconBg: 'bg-orange-50 text-orange-600', icon: <BedDouble className="h-5 w-5" /> },
  { label: 'Khách hàng mới', value: '892', trend: '+18.1%', trendUp: true, iconBg: 'bg-emerald-50 text-emerald-600', icon: <Users className="h-5 w-5" /> },
];

export const AdminDashboard: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex">
    <AdminSidebar />

    <main className="flex-1 ml-64 p-8 min-w-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Tổng quan hoạt động kinh doanh hôm nay.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Xuất báo cáo
          </button>
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            AD
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Recent bookings */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-gray-900">Đặt phòng gần đây</h2>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">Xem tất cả</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                {['Mã ĐP', 'Khách hàng', 'Phòng', 'Ngày', 'Trạng thái', 'Tổng tiền', ''].map((h) => (
                  <th key={h} className="px-5 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_ADMIN_BOOKINGS.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">{b.id}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{b.customer}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{b.room}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{b.date}</td>
                  <td className="px-5 py-4"><StatusBadge status={b.status} /></td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900 text-right">{formatVND(b.amount)}</td>
                  <td className="px-5 py-4 text-right">
                    <button className="text-gray-400 hover:text-gray-600" aria-label="Tùy chọn">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  </div>
);
