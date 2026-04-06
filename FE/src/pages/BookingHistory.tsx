import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ProfileSidebar } from '../components/layout/ProfileSidebar';
import { BookingCard } from '../components/features/BookingCard';
import { Card } from '../components/ui/Card';
import { bookingApi, type ApiBooking } from '../lib/api';

type StatusFilter = 'all' | 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Tất cả',      value: 'all' },
  { label: 'Chờ xử lý',   value: 'PENDING' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Hoàn thành',  value: 'COMPLETED' },
  { label: 'Đã hủy',      value: 'CANCELLED' },
];

export const BookingHistory: React.FC = () => {
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [activeTab, setActiveTab] = useState<StatusFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookingApi.list();
      setBookings(data);
    } catch {
      setError('Không thể tải lịch sử đặt phòng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn hủy đặt phòng này?')) return;
    try {
      await bookingApi.cancel(id);
      setBookings((prev) =>
        prev.map((b) => b.booking_id === id ? { ...b, status: 'CANCELLED' } : b)
      );
    } catch (e: any) {
      alert(e.message ?? 'Hủy thất bại');
    }
  };

  const filtered = activeTab === 'all'
    ? bookings
    : bookings.filter((b) => b.status === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-60 shrink-0">
            <ProfileSidebar />
          </div>

          <div className="flex-1 min-w-0">
            <Card>
              <h1 className="text-xl font-bold text-gray-900 mb-6">Lịch sử đặt phòng</h1>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                {STATUS_TABS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : error ? (
                <div className="text-center py-16 text-red-500 text-sm">{error}</div>
              ) : filtered.length > 0 ? (
                <div className="space-y-5">
                  {filtered.map((booking) => (
                    <BookingCard key={booking.booking_id} booking={booking} onCancel={handleCancel} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <p className="font-medium mb-1">Không có đặt phòng nào</p>
                  <p className="text-sm">Bạn chưa có lịch sử đặt phòng trong mục này.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
