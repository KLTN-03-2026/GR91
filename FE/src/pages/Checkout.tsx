import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CreditCard, ShieldCheck, CheckCircle2, Building,
  Clock, Calendar, Users, Loader2, AlertCircle, BedDouble, Maximize2,
} from 'lucide-react';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatVND, formatDate } from '../lib/utils';
import { COUNTRIES } from '../lib/constants';
import { bookingApi } from '../lib/api';
import { useAuth } from '../lib/auth';

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS = ['Thông tin', 'Thanh toán', 'Xác nhận'];

const PAYMENT_METHODS = [
  { id: 'CARD',  label: 'Thẻ Tín dụng / Ghi nợ',    icon: CreditCard  },
  { id: 'BANK',  label: 'Chuyển khoản ngân hàng',    icon: Building    },
  { id: 'CASH',  label: 'Thanh toán tại khách sạn',  icon: ShieldCheck },
];

// Check-in time options (early check-in)
const CHECKIN_TIMES = [
  { value: '',      label: 'Tiêu chuẩn (14:00) — Miễn phí' },
  { value: '05:00', label: '05:00 – 09:00 (+50% / đêm)' },
  { value: '09:00', label: '09:00 – 14:00 (+30% / đêm)' },
];

// Check-out time options (late check-out)
const CHECKOUT_TIMES = [
  { value: '',      label: 'Tiêu chuẩn (12:00) — Miễn phí' },
  { value: '12:00', label: '12:00 – 15:00 (+30% / đêm)' },
  { value: '15:00', label: '15:00 – 18:00 (+50% / đêm)' },
  { value: '18:00', label: 'Sau 18:00 (+100% / đêm)' },
];

// ─── Fee calculators (mirror backend logic) ───────────────────────────────────
function calcEarlyFee(time: string, basePerNight: number): number {
  if (!time) return 0;
  const h = parseInt(time.split(':')[0], 10);
  if (h >= 5  && h < 9)  return Math.round(basePerNight * 0.5);
  if (h >= 9  && h < 14) return Math.round(basePerNight * 0.3);
  return 0;
}

function calcLateFee(time: string, basePerNight: number): number {
  if (!time) return 0;
  const h = parseInt(time.split(':')[0], 10);
  if (h >= 12 && h < 15) return Math.round(basePerNight * 0.3);
  if (h >= 15 && h < 18) return Math.round(basePerNight * 0.5);
  if (h >= 18)           return Math.round(basePerNight * 1.0);
  return 0;
}

// ─── Countdown timer ─────────────────────────────────────────────────────────
function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return { remaining, label: `${mins}:${secs.toString().padStart(2, '0')}` };
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-10 max-w-xs">
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${done || active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {done ? '✓' : num}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 rounded ${step > num ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State passed from RoomDetail
  const {
    room,
    checkIn:  initCheckIn  = '',
    checkOut: initCheckOut = '',
    guestCount: initGuests = 1,
    nights:   initNights   = 1,
  } = location.state ?? {};

  // ── Step 1: guest info ──
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone,    setPhone]    = useState(user?.phone ?? '');
  const [country,  setCountry]  = useState('Việt Nam');
  const [special,  setSpecial]  = useState('');

  // ── Time options ──
  const [checkInTime,  setCheckInTime]  = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');

  // ── Step 2: payment ──
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // ── Flow state ──
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── Booking result ──
  const [bookingResult, setBookingResult] = useState<{
    booking_id: number;
    total_price: number;
    base_price: number;
    early_fee: number;
    late_fee: number;
    nights: number;
    expires_at: string;
  } | null>(null);

  const [paying,    setPaying]    = useState(false);
  const [payError,  setPayError]  = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const countdown = useCountdown(bookingResult?.expires_at ?? null);

  // ── Price calculation (live preview) ──
  const nights       = initNights || 1;
  const basePerNight = room?.price ?? 0;
  const basePrice    = basePerNight * nights;
  const earlyFee     = calcEarlyFee(checkInTime, basePerNight);
  const lateFee      = calcLateFee(checkOutTime, basePerNight);
  const subtotal     = basePrice + earlyFee + lateFee;
  const vat          = Math.round(subtotal * 0.10);
  const svcFee       = Math.round(subtotal * 0.05);
  const total        = subtotal + vat + svcFee;

  // ── Step 1 submit: create booking ──
  const handleCreateBooking = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room?.room_id) { setError('Thiếu thông tin phòng'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await bookingApi.create({
        room_id:        room.room_id,
        check_in:       initCheckIn,
        check_out:      initCheckOut,
        check_in_time:  checkInTime  || undefined,
        check_out_time: checkOutTime || undefined,
        guests:         [{ full_name: fullName, phone }],
        payment_method: paymentMethod,
      });
      setBookingResult(result);
      setStep(2);
    } catch (e: any) {
      setError(e.message ?? 'Không thể tạo đặt phòng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [room, initCheckIn, initCheckOut, checkInTime, checkOutTime, fullName, phone, paymentMethod]);

  // ── Step 2 submit: pay ──
  const handlePay = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingResult) return;
    if (countdown.remaining === 0) {
      setPayError('Đặt phòng đã hết hạn. Vui lòng thực hiện lại.');
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      await bookingApi.pay(bookingResult.booking_id);
      setConfirmed(true);
      setStep(3);
    } catch (e: any) {
      setPayError(e.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
    } finally {
      setPaying(false);
    }
  }, [bookingResult, countdown.remaining]);

  // ── Success screen ──
  if (step === 3 && confirmed && bookingResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center p-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Đặt phòng thành công!</h2>
          <p className="text-gray-500 text-sm mb-4">Cảm ơn bạn đã chọn SmartHotel.</p>

          <div className="bg-gray-50 rounded-2xl p-5 text-left space-y-2 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Mã đặt phòng</span>
              <span className="font-bold text-gray-900">#{bookingResult.booking_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phòng</span>
              <span className="font-medium text-gray-800">{room?.room_number ?? room?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Nhận phòng</span>
              <span className="font-medium text-gray-800">
                {formatDate(initCheckIn)}{checkInTime ? ` lúc ${checkInTime}` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trả phòng</span>
              <span className="font-medium text-gray-800">
                {formatDate(initCheckOut)}{checkOutTime ? ` lúc ${checkOutTime}` : ''}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-700 font-semibold">Tổng thanh toán</span>
              <span className="font-bold text-blue-600">{formatVND(bookingResult.total_price)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button fullWidth onClick={() => navigate('/history')}>
              Xem lịch sử đặt phòng
            </Button>
            <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
              Về trang chủ
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const fallbackImg = 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80';

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back */}
        <button
          onClick={() => step === 2 ? setStep(1) : navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 mb-8 font-medium"
        >
          <ChevronLeft className="h-4 w-4" /> Quay lại
        </button>

        <StepBar step={step} />

        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Left: form ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ── STEP 1: Guest info + time options ── */}
            {step === 1 && (
              <Card>
                <form onSubmit={handleCreateBooking}>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Thông tin liên hệ</h2>

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <Input
                      label="Họ và tên *"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                    />
                    <Input
                      label="Số điện thoại *"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+84 123 456 789"
                    />
                    <Select
                      label="Quốc gia"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                    />
                  </div>

                  {/* Time options */}
                  <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-5 mb-5 space-y-4">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Tùy chọn giờ nhận / trả phòng
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Giờ nhận phòng sớm
                        </label>
                        <select
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CHECKIN_TIMES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1.5">
                          Giờ trả phòng muộn
                        </label>
                        <select
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {CHECKOUT_TIMES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {(earlyFee > 0 || lateFee > 0) && (
                      <p className="text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                        Phụ phí thời gian: {earlyFee > 0 && `Nhận sớm +${formatVND(earlyFee)}`}
                        {earlyFee > 0 && lateFee > 0 && ' · '}
                        {lateFee > 0 && `Trả muộn +${formatVND(lateFee)}`}
                      </p>
                    )}
                  </div>

                  <Button type="submit" fullWidth size="lg" disabled={loading}>
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang xử lý...</>
                      : 'Tiếp tục đến thanh toán'
                    }
                  </Button>
                </form>
              </Card>
            )}

            {/* ── STEP 2: Payment ── */}
            {step === 2 && bookingResult && (
              <Card>
                <form onSubmit={handlePay}>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Thanh toán</h2>
                    {/* Countdown */}
                    <div className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full
                      ${countdown.remaining > 120000 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600 animate-pulse'}`}>
                      <Clock className="h-3.5 w-3.5" />
                      {countdown.remaining > 0 ? `Hết hạn sau ${countdown.label}` : 'Đã hết hạn'}
                    </div>
                  </div>

                  {payError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {payError}
                    </div>
                  )}

                  {countdown.remaining === 0 && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                      Đặt phòng đã hết hạn. Vui lòng quay lại và thực hiện lại.
                    </div>
                  )}

                  <div className="space-y-3 mb-6">
                    {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                      <label
                        key={id}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-colors
                          ${paymentMethod === id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment"
                            value={id}
                            checked={paymentMethod === id}
                            onChange={() => setPaymentMethod(id)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm font-medium text-gray-900">{label}</span>
                        </div>
                        <Icon className={`h-5 w-5 ${paymentMethod === id ? 'text-blue-600' : 'text-gray-400'}`} />
                      </label>
                    ))}
                  </div>

                  {paymentMethod === 'CARD' && (
                    <div className="bg-gray-50 rounded-xl p-5 space-y-4 mb-6 border border-gray-200">
                      <Input label="Tên trên thẻ" type="text" required placeholder="NGUYEN VAN A" />
                      <Input label="Số thẻ" type="text" required placeholder="0000 0000 0000 0000" />
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Ngày hết hạn" type="text" required placeholder="MM/YY" />
                        <Input label="CVC/CVV" type="text" required placeholder="123" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 text-sm text-green-800 bg-green-50 p-4 rounded-xl mb-6">
                    <ShieldCheck className="h-5 w-5 shrink-0 text-green-600" />
                    Thông tin thanh toán được mã hóa an toàn và bảo mật 100%.
                  </div>

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    disabled={paying || countdown.remaining === 0}
                  >
                    {paying
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang xử lý...</>
                      : `Thanh toán ${formatVND(bookingResult.total_price)}`
                    }
                  </Button>
                </form>
              </Card>
            )}
          </div>

          {/* ── Right: order summary ── */}
          <div className="w-full lg:w-80 shrink-0">
            <Card className="sticky top-24">
              <h3 className="text-base font-bold text-gray-900 mb-5">Chi tiết đặt phòng</h3>

              {/* Room info */}
              <div className="flex gap-3 mb-5 pb-5 border-b border-gray-100">
                <img
                  src={room?.image ?? fallbackImg}
                  alt={room?.name ?? 'Phòng'}
                  className="w-20 h-20 object-cover rounded-xl shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = fallbackImg; }}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">
                    {room?.type_name ?? room?.name}
                  </p>
                  {room?.room_number && (
                    <p className="text-xs text-gray-500 mt-0.5">Phòng {room.room_number}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                    {room?.capacity && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {room.capacity} khách
                      </span>
                    )}
                    {room?.area_sqm && (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3 w-3" /> {room.area_sqm} m²
                      </span>
                    )}
                    {room?.beds?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {room.beds.map((b: any) => `${b.quantity} ${b.name}`).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-1.5 text-xs text-gray-600 mb-5 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <span>Nhận: <span className="font-medium text-gray-800">{formatDate(initCheckIn)}</span>
                    {checkInTime && <span className="text-blue-600 ml-1">lúc {checkInTime}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-400" />
                  <span>Trả: <span className="font-medium text-gray-800">{formatDate(initCheckOut)}</span>
                    {checkOutTime && <span className="text-blue-600 ml-1">lúc {checkOutTime}</span>}
                  </span>
                </div>
                <p className="text-gray-500">{nights} đêm · {initGuests} khách</p>
              </div>

              {/* Price breakdown */}
              <div className="space-y-2 text-sm mb-5 pb-5 border-b border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>{formatVND(basePerNight)} × {nights} đêm</span>
                  <span>{formatVND(basePrice)}</span>
                </div>
                {earlyFee > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Nhận phòng sớm</span>
                    <span>+{formatVND(earlyFee)}</span>
                  </div>
                )}
                {lateFee > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Trả phòng muộn</span>
                    <span>+{formatVND(lateFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Phí dịch vụ (5%)</span>
                  <span>{formatVND(svcFee)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Thuế VAT (10%)</span>
                  <span>{formatVND(vat)}</span>
                </div>
              </div>

              <div className="flex justify-between font-bold text-gray-900 mb-5">
                <span>Tổng cộng</span>
                <span className="text-blue-600">{formatVND(total)}</span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl text-xs text-gray-600">
                <p className="font-semibold text-gray-800 mb-1">Chính sách hủy phòng</p>
                <p>Hủy miễn phí trước 48 giờ nhận phòng. Sau thời gian này sẽ tính phí 1 đêm.</p>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};
