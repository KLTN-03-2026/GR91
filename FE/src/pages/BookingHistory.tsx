import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, Star, X, MessageSquare, AlertCircle, CheckCircle2, Pencil } from 'lucide-react';
import { ProfileSidebar } from '../components/layout/ProfileSidebar';
import { BookingCard } from '../components/features/BookingCard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { bookingApi, reviewApi, type ApiBooking, type MyReview } from '../lib/api';

type StatusFilter = 'all' | 'PENDING' | 'PARTIALLY_PAID' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'Tất cả',      value: 'all'       },
  { label: 'Chờ xử lý',   value: 'PENDING'   },
  { label: 'Đã cọc',      value: 'PARTIALLY_PAID' },
  { label: 'Đã xác nhận', value: 'CONFIRMED' },
  { label: 'Hoàn thành',  value: 'COMPLETED' },
  { label: 'Đã hủy',      value: 'CANCELLED' },
];

// ── Star Rating Picker ────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const LABELS = ['', 'Tệ', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Tuyệt vời!'];
  const display = hovered || value;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-125"
            aria-label={`${star} sao`}
          >
            <Star className={`h-8 w-8 transition-colors ${
              star <= display ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'
            }`} />
          </button>
        ))}
      </div>
      {display > 0 && <p className="text-sm font-medium text-yellow-600">{LABELS[display]}</p>}
    </div>
  );
}

// ── Review Modal (tạo mới + chỉnh sửa) ───────────────────────────────────────
function ReviewModal({
  booking,
  existing,   // nếu có → chế độ chỉnh sửa
  onClose,
  onSuccess,
}: {
  booking: ApiBooking;
  existing?: MyReview | null;
  onClose: () => void;
  onSuccess: (bookingId: number, updated: MyReview) => void;
}) {
  const isEdit = !!existing;

  const [rating,  setRating]  = useState(existing?.rating  ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');
  const [done,  setDone]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError('Vui lòng chọn số sao đánh giá.'); return; }
    setSubmitting(true);
    setError('');
    try {
      if (isEdit && existing) {
        await reviewApi.update(existing.review_id, { rating, comment: comment.trim() || undefined });
        setDone(true);
        const updated: MyReview = { ...existing, rating, comment: comment.trim() || null, status: 'VISIBLE' };
        setTimeout(() => { onSuccess(booking.booking_id, updated); onClose(); }, 1200);
      } else {
        const res = await reviewApi.create({
          booking_id: booking.booking_id,
          rating,
          comment: comment.trim() || undefined,
        });
        setDone(true);
        const created: MyReview = {
          review_id:    res.review_id,
          booking_id:   booking.booking_id,
          room_type_id: 0,
          rating,
          comment:      comment.trim() || null,
          created_at:   new Date().toISOString(),
          status:       'VISIBLE',
        };
        setTimeout(() => { onSuccess(booking.booking_id, created); onClose(); }, 1200);
      }
    } catch (e: any) {
      setError(e.message ?? 'Thao tác thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isEdit
              ? <Pencil className="h-5 w-5 text-blue-600" />
              : <MessageSquare className="h-5 w-5 text-blue-600" />
            }
            <h2 className="font-bold text-gray-900">
              {isEdit ? 'Chỉnh sửa đánh giá' : 'Đánh giá phòng'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-5 text-sm">
            <p className="font-semibold text-gray-900">{booking.room_type} – Phòng {booking.room_number}</p>
            <p className="text-gray-500 text-xs mt-0.5">Mã đặt phòng #{booking.booking_id}</p>
          </div>

          {done ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <p className="font-bold text-gray-900">
                {isEdit ? 'Đã cập nhật đánh giá!' : 'Cảm ơn bạn đã đánh giá!'}
              </p>
              <p className="text-sm text-gray-500">Đánh giá của bạn giúp cải thiện dịch vụ của chúng tôi.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                  Bạn đánh giá phòng này thế nào?
                </label>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nhận xét <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Chia sẻ trải nghiệm của bạn về phòng và dịch vụ..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/500</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
                  Hủy
                </Button>
                <Button type="submit" fullWidth disabled={submitting || rating === 0}>
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Đang lưu...</>
                    : isEdit ? 'Cập nhật' : 'Gửi đánh giá'
                  }
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const BookingHistory: React.FC = () => {
  const [bookings,   setBookings]   = useState<ApiBooking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeTab,  setActiveTab]  = useState<StatusFilter>('all');
  const location = useLocation();

  // Map bookingId → MyReview (từ DB)
  const [myReviews, setMyReviews] = useState<Map<number, MyReview>>(new Map());

  // Modal state
  const [reviewTarget,   setReviewTarget]   = useState<ApiBooking | null>(null);
  const [editingReview,  setEditingReview]  = useState<MyReview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, reviews] = await Promise.all([
        bookingApi.list(),
        reviewApi.myReviews().catch(() => [] as MyReview[]),
      ]);
      setBookings(data);
      setMyReviews(new Map(reviews.map((r) => [r.booking_id, r])));
    } catch {
      setError('Không thể tải lịch sử đặt phòng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload khi navigate về từ trang thanh toán (kể cả khi component đã mount sẵn)
  useEffect(() => {
    if (!(location.state as any)?.refresh) return;
    // Delay 800ms để đảm bảo BE đã commit transaction xong
    const t = setTimeout(() => load(), 800);
    return () => clearTimeout(t);
  }, [location.key]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn hủy đặt phòng này?')) return;
    try {
      await bookingApi.cancel(id);
      setBookings((prev) => prev.map((b) => b.booking_id === id ? { ...b, status: 'CANCELLED' } : b));
    } catch (e: any) {
      alert(e.message ?? 'Hủy thất bại');
    }
  };

  // Mở modal — nếu đã review thì truyền existing để chỉnh sửa
  const handleOpenReview = (booking: ApiBooking) => {
    setReviewTarget(booking);
    setEditingReview(myReviews.get(booking.booking_id) ?? null);
  };
  const handleReviewSuccess = (_bookingId: number, updated: MyReview) => {
    setMyReviews((prev) => new Map(prev).set(updated.booking_id, updated));
    setReviewTarget(null);
    setEditingReview(null);
  };

  const filtered = activeTab === 'all'
    ? bookings
    : bookings.filter((b) => b.status === activeTab);

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          existing={editingReview}
          onClose={() => { setReviewTarget(null); setEditingReview(null); }}
          onSuccess={handleReviewSuccess}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-60 shrink-0">
            <ProfileSidebar />
          </div>

          <div className="flex-1 min-w-0">
            <Card>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-xl font-bold text-gray-900">Lịch sử đặt phòng</h1>
                
                {bookings.length > 0 && bookings.some(b => Number(b.remaining_amount ?? 0) > 0 && b.status !== 'CANCELLED') && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Tổng tiền cần thanh toán</p>
                      <p className="text-xl font-black text-blue-700">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                          bookings.reduce((sum, b) => {
                            if (b.status === 'CANCELLED') return sum;
                            return sum + Number(b.remaining_amount ?? 0);
                          }, 0)
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
                {STATUS_TABS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                    <BookingCard
                      key={booking.booking_id}
                      booking={booking}
                      onCancel={handleCancel}
                      onReview={handleOpenReview}
                      onRefresh={load}
                      existingReview={myReviews.get(booking.booking_id)}
                    />
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
