import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { bookingApi } from '../lib/api';

const VNP_MESSAGES: Record<string, string> = {
  '07': 'Giao dịch bị nghi ngờ gian lận.',
  '09': 'Thẻ/Tài khoản chưa đăng ký InternetBanking.',
  '10': 'Xác thực thông tin thẻ không đúng quá 3 lần.',
  '11': 'Đã hết hạn chờ thanh toán.',
  '12': 'Thẻ/Tài khoản bị khóa.',
  '13': 'Nhập sai mật khẩu OTP.',
  '24': 'Giao dịch bị hủy.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản vượt hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng đang bảo trì.',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định.',
  '99': 'Lỗi không xác định.',
};

export const VNPayReturn: React.FC = () => {
  const location = useLocation();
  const navigate  = useNavigate();

  const [status,    setStatus]    = useState<'loading' | 'success' | 'pending' | 'failed'>('loading');
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [message,   setMessage]   = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code   = params.get('vnp_ResponseCode') ?? '';
    const txnRef = params.get('vnp_TxnRef');
    const qs     = location.search.slice(1); // bỏ dấu ?

    if (txnRef) setBookingId(Number(txnRef));

    // Nếu VNPay báo thất bại ngay → không cần gọi BE
    if (!code || code !== '00') {
      setStatus('failed');
      setMessage(VNP_MESSAGES[code] ?? (code ? `Thanh toán thất bại (mã: ${code})` : 'Không có thông tin thanh toán.'));
      return;
    }

    // code === '00' → gọi BE 1 lần để update DB và lấy kết quả
    bookingApi.vnpayReturn(qs)
      .then((res) => {
        if (res.success || res.status === 'CONFIRMED' || res.status === 'PARTIALLY_PAID') {
          setStatus('success');
          setMessage(
            res.status === 'PARTIALLY_PAID'
              ? 'Thanh toán cọc thành công. Đặt phòng của bạn đã được giữ và còn khoản cần thanh toán sau.'
              : 'Thanh toán thành công. Đặt phòng của bạn đã được xác nhận.',
          );
        } else if (res.verified && res.status === 'PENDING') {
          setStatus('pending');
          setMessage('Giao dịch đã được ghi nhận nhưng đang chờ đồng bộ trạng thái. Vui lòng kiểm tra lại trong lịch sử đặt phòng.');
        } else {
          setStatus('failed');
          setMessage(res.message || 'Thanh toán thất bại.');
        }
      })
      .catch((err: any) => {
        setStatus('pending');
        setMessage(err?.message || 'Chưa thể xác nhận trạng thái giao dịch ngay lúc này. Vui lòng kiểm tra lại trong lịch sử đặt phòng.');
      });
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600 font-medium">Đang xác nhận thanh toán...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <Card className="max-w-md w-full text-center p-10">
        {status === 'success' ? (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thanh toán thành công!</h2>
            <p className="text-gray-500 text-sm mb-6">{message}</p>
            {bookingId && (
              <p className="text-sm font-medium text-gray-700 mb-6">
                Mã đặt phòng: <span className="text-blue-600">#{bookingId}</span>
              </p>
            )}
            <div className="space-y-3">
              <Button fullWidth onClick={() => navigate('/history', { state: { refresh: true } })}>
                Xem lịch sử đặt phòng
              </Button>
              <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
            </div>
          </>
        ) : status === 'pending' ? (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Đang xử lý giao dịch</h2>
            <p className="text-gray-500 text-sm mb-6">{message}</p>
            {bookingId && (
              <p className="text-xs text-gray-400 mb-6">Mã đặt phòng: #{bookingId}</p>
            )}
            <div className="space-y-3">
              <Button fullWidth onClick={() => navigate('/history', { state: { refresh: true } })}>
                Kiểm tra lịch sử đặt phòng
              </Button>
              <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thanh toán thất bại</h2>
            <p className="text-gray-500 text-sm mb-6">{message}</p>
            {bookingId && (
              <p className="text-xs text-gray-400 mb-6">Mã đặt phòng: #{bookingId}</p>
            )}
            <div className="space-y-3">
              <Button fullWidth onClick={() => navigate('/history', { state: { refresh: true } })}>
                Xem lịch sử đặt phòng
              </Button>
              <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
