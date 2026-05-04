import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Hash, Star, X, Clock, Users, CreditCard,
  Loader2, Receipt, ChevronRight, Pencil, MapPin, Key, CheckCircle,
  ShieldCheck, AlertCircle,
} from 'lucide-react';
import type { ApiBooking, MyReview } from '../../lib/api';
import { bookingApi } from '../../lib/api';
import { formatVND, formatDate, formatTime } from '../../lib/utils';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&q=80';

// ── Fee helpers (mirror backend) ──────────────────────────────────────────────
function calcEarlyFee(time: string | null | undefined, perNight: number) {
  if (!time) return 0;
  const h = parseInt(time.split(':')[0], 10);
  if (h >= 5  && h < 9)  return Math.round(perNight * 0.5);
  if (h >= 9  && h < 14) return Math.round(perNight * 0.3);
  return 0;
}
function calcLateFee(time: string | null | undefined, perNight: number) {
  if (!time) return 0;
  const h = parseInt(time.split(':')[0], 10);
  if (h >= 12 && h < 15) return Math.round(perNight * 0.3);
  if (h >= 15 && h < 18) return Math.round(perNight * 0.5);
  if (h >= 18)           return Math.round(perNight * 1.0);
  return 0;
}

// ── Pay Remaining Modal ───────────────────────────────────────────────────────
function PayRemainingModal({
  booking,
  onClose,
  onSuccess,
}: {
  booking: ApiBooking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<'VNPAY' | 'CASH'>('VNPAY');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const remaining = Number(booking.remaining_amount ?? 0);
  const paid = Number(booking.paid_amount ?? 0);

  const handlePay = async () => {
    setPaying(true);
    setError('');
    try {
      if (method === 'VNPAY') {
        const { paymentUrl } = await bookingApi.vnpayInitiate(booking.booking_id);
        window.location.href = paymentUrl;
        return;
      }
      // CASH
      await bookingApi.pay(booking.booking_id);
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Thanh toán số tiền còn lại</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Tóm tắt */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Tổng tiền đặt phòng</span>
              <span className="font-medium text-gray-900">{formatVND(booking.total_price)}</span>
            </div>
            <div className="flex justify-between text-green-700">
              <span>Đã thanh toán</span>
              <span className="font-medium">{formatVND(paid)}</span>
            </div>
            <div className="flex justify-between text-red-600 border-t border-dashed border-gray-200 pt-2 font-bold text-base">
              <span>Còn cần thanh toán</span>
              <span>{formatVND(remaining)}</span>
            </div>
          </div>

          {/* Phương thức */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phương thức thanh toán</p>
            {([
              { id: 'VNPAY' as const, label: 'VNPay (ATM / QR / Thẻ quốc tế)', icon: CreditCard },
              { id: 'CASH'  as const, label: 'Thanh toán tiền mặt tại quầy',    icon: ShieldCheck },
            ]).map(({ id, label, icon: Icon }) => (
              <label
                key={id}
                className={`flex items-center justify-between p-3.5 rounded-xl border-2 cursor-pointer transition-colors
                  ${method === id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="pay-method"
                    checked={method === id}
                    onChange={() => setMethod(id)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-900">{label}</span>
                </div>
                <Icon className={`h-4 w-4 ${method === id ? 'text-blue-600' : 'text-gray-400'}`} />
              </label>
            ))}
          </div>

          {method === 'CASH' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              Vui lòng đến quầy lễ tân để thanh toán tiền mặt. Nhân viên sẽ xác nhận giao dịch.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={paying}>Hủy</Button>
          <Button variant="primary" fullWidth onClick={handlePay} disabled={paying}>
            {paying
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Đang xử lý...</>
              : method === 'VNPAY'
                ? `Thanh toán ${formatVND(remaining)}`
                : 'Xác nhận đã thanh toán'
            }
          </Button>
        </div>
      </div>
    </div>
  );
}


function DetailModal({ bookingId, onClose, onPaySuccess }: { bookingId: number; onClose: () => void; onPaySuccess?: () => void }) {
  const [detail, setDetail] = React.useState<ApiBooking | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  const loadDetail = React.useCallback(() => {
    setLoading(true);
    bookingApi.detail(bookingId)
      .then(setDetail)
      .catch(() => setError('Không thể tải chi tiết đặt phòng.'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  React.useEffect(() => { loadDetail(); }, [loadDetail]);

  // Tính breakdown giá
  const priceBreakdown = React.useMemo(() => {
    if (!detail) return null;
    const nights = detail.check_in && detail.check_out
      ? Math.max(1, Math.floor((new Date(detail.check_out).getTime() - new Date(detail.check_in).getTime()) / 86400000))
      : 1;
    const roomPrice    = detail.room_price ?? 0;
    const pricePerNight = nights > 0 ? Math.round(roomPrice / nights) : roomPrice;
    const earlyFee     = calcEarlyFee(detail.check_in_time, pricePerNight);
    const lateFee      = calcLateFee(detail.check_out_time, pricePerNight);
    const subtotal     = roomPrice + earlyFee + lateFee;
    const svcFee       = Math.round(subtotal * 0.05);
    const vat          = Math.round(subtotal * 0.10);
    return { nights, roomPrice, pricePerNight, earlyFee, lateFee, svcFee, vat };
  }, [detail]);

  const canRepay = (
    detail?.status?.toUpperCase() === 'PENDING' ||
    detail?.status?.toUpperCase() === 'PARTIALLY_PAID' ||
    detail?.status?.toUpperCase() === 'CHECKED_IN'
  ) && Number(detail?.remaining_amount ?? 0) > 0;

  const handleRepay = () => {
    if (!detail) return;
    const nights = detail.check_in && detail.check_out
      ? Math.max(1, Math.floor((new Date(detail.check_out).getTime() - new Date(detail.check_in).getTime()) / 86400000))
      : 1;
    navigate('/checkout', {
      state: {
        room_id:          detail.rooms?.[0]?.room_id,
        room_number:      detail.room_number,
        type_name:        detail.room_type,
        image:            detail.rooms?.[0]?.image ?? null,
        check_in:         detail.check_in,
        check_out:        detail.check_out,
        check_in_time:    detail.check_in_time ?? '',
        check_out_time:   detail.check_out_time ?? '',
        nights,
        base_price:       detail.room_price ? Math.round(detail.room_price / nights) : 0,
        subtotal:         detail.room_price ?? 0,
        existingBookingId: detail.booking_id,
        existingBookingResult: {
          booking_id:  detail.booking_id,
          total_price: detail.total_price,
          amount_due_now: Number(detail.remaining_amount ?? detail.total_price),
          payment_percent: 100,
          payment_policy: (detail.remaining_amount ?? 0) > 0 ? 'DEPOSIT' : 'FULL',
          paid_amount: Number(detail.paid_amount ?? 0),
          remaining_amount: Number(detail.remaining_amount ?? 0),
          base_price:  detail.room_price ?? 0,
          early_fee:   0,
          late_fee:    0,
          nights,
          expires_at:  detail.expires_at ?? '',
        },
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-lg font-bold text-gray-900">
              {loading ? 'Chi tiết đặt phòng' : `Đặt phòng #${detail?.booking_id}`}
            </p>
            {detail && (
              <p className="text-xs text-gray-400 mt-0.5">Đặt lúc {formatDate(detail.created_at)}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detail && <StatusBadge status={detail.status.toLowerCase() as any} />}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-10 text-red-500 text-sm">{error}</div>
          )}

          {detail && priceBreakdown && (
            <>
              {/* Ảnh + tên phòng */}
              <div className="flex gap-4">
                <img
                  src={detail.rooms?.[0]?.image ?? FALLBACK_IMG}
                  alt={detail.room_type}
                  className="w-24 h-24 object-cover rounded-xl shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-base">{detail.room_type}</p>
                  <p className="text-sm text-gray-500">Phòng {detail.room_number}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      {formatDate(detail.check_in)}
                      {detail.check_in_time && (
                        <span className="text-blue-600 ml-0.5">{formatTime(detail.check_in_time)}</span>
                      )}
                    </span>
                    <span className="text-gray-300">→</span>
                    <span className="flex items-center gap-1">
                      {formatDate(detail.check_out)}
                      {detail.check_out_time && (
                        <span className="text-blue-600 ml-0.5">{formatTime(detail.check_out_time)}</span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{priceBreakdown.nights} đêm</p>
                </div>
              </div>

              {/* Hoá đơn chi tiết */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-200">
                  <Receipt className="h-4 w-4 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hoá đơn</p>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>
                      Giá phòng ({priceBreakdown.nights} đêm × {formatVND(priceBreakdown.pricePerNight)})
                    </span>
                    <span className="font-medium">{formatVND(priceBreakdown.roomPrice)}</span>
                  </div>

                  {priceBreakdown.earlyFee > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Nhận phòng sớm ({formatTime(detail.check_in_time)})
                      </span>
                      <span>+{formatVND(priceBreakdown.earlyFee)}</span>
                    </div>
                  )}

                  {priceBreakdown.lateFee > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Trả phòng muộn ({formatTime(detail.check_out_time)})
                      </span>
                      <span>+{formatVND(priceBreakdown.lateFee)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-400 text-xs border-t border-dashed border-gray-200 pt-2">
                    <span>Phí dịch vụ (5%)</span>
                    <span>{formatVND(priceBreakdown.svcFee)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-xs">
                    <span>Thuế VAT (10%)</span>
                    <span>{formatVND(priceBreakdown.vat)}</span>
                  </div>

                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
                    <span>Tổng cộng</span>
                    <span className="text-blue-600">{formatVND(detail.total_price)}</span>
                  </div>
                  {(() => {
                    const paid      = Number(detail.paid_amount ?? 0);
                    const remaining = Number(detail.remaining_amount ?? 0);
                    // Tính lại remaining từ total - paid để tránh lỗi DB
                    const actualRemaining = Math.max(0, detail.total_price - paid);
                    return (
                      <>
                        {paid > 0 && (
                          <div className="flex justify-between text-green-700 text-xs pt-1">
                            <span>Đã thanh toán</span>
                            <span className="font-semibold">{formatVND(paid)}</span>
                          </div>
                        )}
                        {actualRemaining > 0 && detail.status !== 'CANCELLED' && (
                          <div className="flex justify-between text-amber-700 text-xs font-semibold border-t border-dashed border-amber-200 pt-1 mt-1">
                            <span>Còn phải thanh toán</span>
                            <span className="text-red-600">{formatVND(actualRemaining)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Khách */}
              {detail.guests && detail.guests.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Khách lưu trú
                  </p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    {detail.guests.map((g, i) => (
                      <div
                        key={g.booking_guest_id}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <span className="font-medium text-gray-800">{g.full_name}</span>
                        <span className="text-xs text-gray-400">{g.phone ?? g.email ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thanh toán */}
              {detail.payments && detail.payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Thanh toán
                  </p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    {detail.payments.map((p, i) => (
                      <div
                        key={p.payment_id}
                        className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">{p.method}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${p.status === 'SUCCESS' ? 'bg-green-50 text-green-700 border-green-200' :
                              p.status === 'FAILED'  ? 'bg-red-50 text-red-700 border-red-200' :
                                                       'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                            {p.status === 'SUCCESS' ? 'Thành công' : p.status === 'FAILED' ? 'Thất bại' : 'Chờ xử lý'}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">{formatVND(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {detail && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex gap-3">
            {canRepay && (
              <Button fullWidth variant="primary" onClick={handleRepay}>
                <CreditCard className="h-4 w-4 mr-2" />
                Thanh toán ngay
              </Button>
            )}
            <Button fullWidth variant="secondary" onClick={onClose}>Đóng</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── BookingCard ───────────────────────────────────────────────────────────────
interface BookingCardProps {
  booking: ApiBooking;
  onCancel?: (id: number) => void;
  onReview?: (booking: ApiBooking) => void;
  onRefresh?: () => void;
  existingReview?: MyReview;
  /** @deprecated dùng existingReview */
  reviewed?: boolean;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking, onCancel, onReview, onRefresh, existingReview, reviewed = false,
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showPayRemaining, setShowPayRemaining] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showCheckInConfirm, setShowCheckInConfirm] = useState(false);
  const navigate = useNavigate();

  const status      = booking.status.toLowerCase() as any;
  const isUpcoming  = status === 'confirmed' || status === 'pending' || status === 'partially_paid';
  const isCompleted = booking.status === 'COMPLETED';
  // Ảnh: list API trả về room_image, detail API trả về rooms[0].image
  const image       = booking.room_image ?? booking.rooms?.[0]?.image ?? null;
  const hasReview   = !!existingReview || reviewed;

  // Hiện nút thanh toán lại cho mọi booking PENDING/PARTIALLY_PAID/CHECKED_IN còn nợ
  const canRepay = (
    booking.status === 'PENDING' ||
    booking.status === 'PARTIALLY_PAID' ||
    booking.status === 'CHECKED_IN'
  ) && Number(booking.remaining_amount ?? 0) > 0;

  const handleCardClick = () => {
    const roomId = booking.room_id ?? booking.rooms?.[0]?.room_id;
    if (roomId) navigate(`/room/${roomId}`);
    else if (booking.type_id) navigate(`/rooms/${booking.type_id}`);
  };

  const handleRepay = () => setShowPayRemaining(true);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await bookingApi.checkIn(booking.booking_id);
      setShowCheckInConfirm(false);
      onRefresh?.();
      navigate(`/checkin-ticket/${booking.booking_id}`, { state: { booking } });
    } catch (e: any) {
      alert(e.message ?? 'Check-in thất bại');
    } finally {
      setCheckingIn(false);
    }
  };

  let isToday = false;
  if (booking.check_in) {
    // Dùng UTC+7 để khớp với logic BE, tránh lệch ngày theo timezone browser
    const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayVN = nowVN.toISOString().split('T')[0];
    const checkInStr = String(booking.check_in);
    // Nếu là "YYYY-MM-DD" dùng trực tiếp, nếu là ISO string thì parse + offset
    const checkInDate = checkInStr.length === 10
      ? checkInStr
      : new Date(new Date(checkInStr).getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    isToday = todayVN === checkInDate;
  }
  const canCheckIn = booking.status === 'CONFIRMED' && isToday;

  return (
    <>
      {showDetail && (
        <DetailModal
          bookingId={booking.booking_id}
          onClose={() => setShowDetail(false)}
          onPaySuccess={() => { setShowDetail(false); onRefresh?.(); }}
        />
      )}

      {showPayRemaining && (
        <PayRemainingModal
          booking={booking}
          onClose={() => setShowPayRemaining(false)}
          onSuccess={() => { setShowPayRemaining(false); onRefresh?.(); }}
        />
      )}

      {showCheckInConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Key className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Xác nhận nhận phòng</h3>
            <p className="text-sm text-gray-500">
              Bạn đã có mặt tại khách sạn và muốn thực hiện nhận phòng trực tuyến ngay bây giờ?
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" fullWidth onClick={() => setShowCheckInConfirm(false)}>Hủy</Button>
              <Button variant="primary" fullWidth className="bg-green-600 hover:bg-green-700" onClick={handleCheckIn} disabled={checkingIn}>
                {checkingIn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Xác nhận
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div
        onClick={handleCardClick}
        className={`border border-gray-200 rounded-2xl overflow-hidden flex flex-col sm:flex-row transition-shadow
          ${booking.type_id ? 'hover:shadow-md hover:border-blue-200 cursor-pointer' : ''}`}
      >
        <div className="sm:w-44 h-44 sm:h-auto shrink-0">
          <img
            src={image ?? FALLBACK_IMG}
            alt={booking.room_type}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
          />
        </div>

        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-2 mb-1">
              <h3 className="text-base font-bold text-gray-900">
                {booking.room_type} – Phòng {booking.room_number}
              </h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Mã đặt phòng: <span className="font-medium text-gray-800">{booking.booking_id}</span>
            </p>

            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(booking.check_in)}
              {booking.check_in_time && (
                <span className="text-blue-600">{formatTime(booking.check_in_time)}</span>
              )}
              <span className="text-gray-300 mx-0.5">→</span>
              {formatDate(booking.check_out)}
              {booking.check_out_time && (
                <span className="text-blue-600">{formatTime(booking.check_out_time)}</span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-end pt-4 border-t border-gray-100 mt-4">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Tổng tiền</p>
                <p className="font-bold text-gray-900">{formatVND(booking.total_price)}</p>
              </div>
              {Number(booking.paid_amount ?? 0) > 0 && Number(booking.remaining_amount ?? 0) > 0 && booking.status !== 'CANCELLED' && (
                <div>
                  <p className="text-xs text-green-600 mb-0.5">Đã thanh toán</p>
                  <p className="font-semibold text-green-700">{formatVND(Number(booking.paid_amount))}</p>
                </div>
              )}
              {Number(booking.remaining_amount ?? 0) > 0 && booking.status !== 'CANCELLED' && (
                <div>
                  <p className="text-xs text-amber-600 mb-0.5">Còn cần thanh toán</p>
                  <p className="font-black text-red-500">{formatVND(Number(booking.remaining_amount))}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
              {isUpcoming && onCancel && (
                <Button variant="danger" size="sm" onClick={() => onCancel(booking.booking_id)}>
                  Hủy phòng
                </Button>
              )}
              {canRepay && (
                <Button variant="primary" size="sm" onClick={handleRepay} disabled={paying}>
                  {paying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CreditCard className="h-3.5 w-3.5 mr-1" />}
                  Thanh toán
                </Button>
              )}
              {isCompleted && onReview && (
                hasReview ? (
                  <button
                    onClick={() => onReview(booking)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors"
                  >
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    Đã đánh giá
                    <Pencil className="h-3 w-3 ml-0.5 text-yellow-500" />
                  </button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onReview(booking)}>
                    <Star className="h-3.5 w-3.5 mr-1" /> Đánh giá
                  </Button>
                )
              )}
               <Button variant="outline" size="sm" onClick={() => setShowDetail(true)}>
                <ChevronRight className="h-3.5 w-3.5 mr-1" /> Xem chi tiết
              </Button>

              {canCheckIn && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowCheckInConfirm(true)}
                  disabled={checkingIn}
                  className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200 animate-pulse-slow"
                >
                  <MapPin className="h-3.5 w-3.5 mr-1" />
                  Check-in trực tuyến
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
