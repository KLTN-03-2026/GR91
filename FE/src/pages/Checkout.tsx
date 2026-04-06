import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, CreditCard, ShieldCheck, CheckCircle2, Building } from 'lucide-react';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatVND, generateBookingId } from '../lib/utils';
import { COUNTRIES, SERVICE_FEE_RATE, VAT_RATE } from '../lib/constants';

const STEPS = ['Thông tin', 'Thanh toán', 'Xác nhận'];

const PAYMENT_METHODS = [
  { id: 'card', label: 'Thẻ Tín dụng / Ghi nợ', icon: CreditCard },
  { id: 'bank', label: 'Chuyển khoản ngân hàng', icon: Building },
  { id: 'hotel', label: 'Thanh toán tại khách sạn', icon: ShieldCheck },
];

export const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { room, checkIn, checkOut, guests, nights = 1 } = location.state ?? {};

  const fallbackRoom = { name: 'Premium Suite City View', price: 4200000, image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' };
  const r = room ?? fallbackRoom;
  const n = nights ?? 1;

  const base = r.price * n;
  const total = base * (1 + SERVICE_FEE_RATE + VAT_RATE);

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [bookingId] = useState(generateBookingId);

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center p-10">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Đặt phòng thành công!</h2>
          <p className="text-gray-500 text-sm mb-2">Cảm ơn bạn đã chọn SmartHotel.</p>
          <p className="text-gray-600 mb-8">
            Mã xác nhận: <span className="font-bold text-gray-900">#{bookingId}</span>
          </p>
          <div className="space-y-3">
            <Button fullWidth as="button" onClick={() => navigate('/history')}>
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

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back */}
        <button
          onClick={() => (step === 2 ? setStep(1) : navigate(-1))}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 mb-8 font-medium"
        >
          <ChevronLeft className="h-4 w-4" /> Quay lại
        </button>

        {/* Progress */}
        <div className="flex items-center mb-10 max-w-xs">
          {STEPS.map((label, i) => {
            const num = i + 1;
            const done = step > num;
            const active = step === num;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done || active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
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

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Form */}
          <div className="flex-1 min-w-0">
            <Card>
              {step === 1 ? (
                <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Thông tin liên hệ</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <Input label="Họ và tên *" type="text" required placeholder="Nguyễn Văn A" />
                    <Input label="Email *" type="email" required placeholder="you@example.com" />
                    <Input label="Số điện thoại *" type="tel" required placeholder="+84 123 456 789" />
                    <Select
                      label="Quốc gia"
                      options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                    />
                  </div>
                  <Textarea label="Yêu cầu đặc biệt (Không bắt buộc)" rows={3} placeholder="Ví dụ: Cần phòng yên tĩnh, dị ứng thực phẩm..." className="mb-6" />
                  <Button type="submit" fullWidth size="lg">Tiếp tục đến thanh toán</Button>
                </form>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Phương thức thanh toán</h2>

                  <div className="space-y-3 mb-6">
                    {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                      <label
                        key={id}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-colors ${paymentMethod === id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
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

                  {paymentMethod === 'card' && (
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

                  <Button type="submit" fullWidth size="lg">
                    Thanh toán {formatVND(total)}
                  </Button>
                </form>
              )}
            </Card>
          </div>

          {/* Order summary */}
          <div className="w-full lg:w-80 shrink-0">
            <Card className="sticky top-24">
              <h3 className="text-base font-bold text-gray-900 mb-5">Chi tiết đặt phòng</h3>

              <div className="flex gap-3 mb-5 pb-5 border-b border-gray-100">
                <img src={r.image} alt={r.name} className="w-20 h-20 object-cover rounded-xl shrink-0" referrerPolicy="no-referrer" />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{r.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{n} đêm · {guests ?? '2 Người lớn'}</p>
                  {checkIn && <p className="text-xs text-gray-500">Nhận: {checkIn}</p>}
                  {checkOut && <p className="text-xs text-gray-500">Trả: {checkOut}</p>}
                </div>
              </div>

              <div className="space-y-2 text-sm mb-5 pb-5 border-b border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>Giá phòng ({n} đêm)</span>
                  <span>{formatVND(base)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí dịch vụ (5%)</span>
                  <span>{formatVND(base * SERVICE_FEE_RATE)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Thuế VAT (10%)</span>
                  <span>{formatVND(base * VAT_RATE)}</span>
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
