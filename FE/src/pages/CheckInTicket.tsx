import React from 'react';
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Printer, MapPin, Key, Calendar, User, Phone, Download } from 'lucide-react';
import type { ApiBooking } from '../lib/api';
import { formatVND, formatDate, formatTime } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const CheckInTicket: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const booking = location.state?.booking as ApiBooking;

  if (!booking) {
    return <Navigate to="/history" replace />;
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <Button variant="outline" onClick={() => navigate('/history')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quay lại Lịch sử
        </Button>
        <Button variant="primary" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4 mr-2" />
          In Vé Nhận Phòng
        </Button>
      </div>

      <Card className="overflow-hidden border-2 border-green-100 shadow-xl print:shadow-none print:border-none">
        {/* Header Ticket */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Check-in Thành Công!</h1>
            <p className="text-green-50 font-medium text-lg">Chào mừng bạn đến với Smart Hotel</p>
          </div>
        </div>

        {/* Body Ticket */}
        <div className="p-8 bg-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-dashed border-gray-200 pb-6 mb-6 gap-4">
            <div>
              <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-1">Mã Phiếu Điện Tử</p>
              <p className="text-3xl font-black text-gray-900 tracking-tight">#{booking.booking_id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider mb-1">Trạng thái</p>
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 font-bold rounded-full text-sm">
                ĐÃ NHẬN PHÒNG
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1.5"><Key className="h-4 w-4" /> Hạng phòng</p>
                <p className="text-lg font-bold text-gray-900">{booking.room_type}</p>
                <p className="text-blue-600 font-bold text-xl mt-1">Phòng {booking.room_number}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1.5"><User className="h-4 w-4" /> Khách hàng</p>
                <p className="font-bold text-gray-900">{booking.full_name || 'Khách vãng lai'}</p>
              </div>
            </div>

            <div className="space-y-6 bg-gray-50 p-5 rounded-2xl border border-gray-100">
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Nhận phòng</p>
                <p className="font-bold text-gray-900">{formatDate(booking.check_in)}</p>
                {booking.check_in_time && <p className="text-sm text-blue-600">{formatTime(booking.check_in_time)}</p>}
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Trả phòng</p>
                <p className="font-bold text-gray-900">{formatDate(booking.check_out)}</p>
                {booking.check_out_time && <p className="text-sm text-blue-600">{formatTime(booking.check_out_time)}</p>}
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 mb-6 flex justify-between items-center">
             <div>
                <p className="text-sm text-gray-500 font-medium mb-1">Tổng hoá đơn tạm tính</p>
                <p className="text-2xl font-black text-blue-600">{formatVND(booking.total_price)}</p>
             </div>
             {Number(booking.remaining_amount ?? 0) > 0 ? (
               <div className="text-right">
                 <p className="text-sm text-amber-600 font-bold mb-1">Còn nợ (thanh toán khi trả phòng)</p>
                 <p className="text-xl font-black text-amber-700">{formatVND(Number(booking.remaining_amount))}</p>
               </div>
             ) : (
               <div className="text-right">
                 <p className="text-sm text-green-600 font-bold mb-1">Thanh toán</p>
                 <p className="text-xl font-black text-green-700">Đã thanh toán đủ</p>
               </div>
             )}
          </div>

          {/* Footer Guide */}
          <div className="text-center pt-6 border-t border-gray-100">
            <p className="text-gray-500 mb-2">Vui lòng đưa phiếu này hoặc mã số cho Lễ tân để nhận chìa khóa cơ/thẻ từ.</p>
            <div className="inline-flex items-center justify-center p-3 bg-gray-100 rounded-xl">
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=BOOKING_${booking.booking_id}`} alt="QR Code" className="w-24 h-24 mix-blend-multiply" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
