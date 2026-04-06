import React from 'react';
import { Calendar, Hash } from 'lucide-react';
import type { ApiBooking } from '../../lib/api';
import { formatVND, formatDate } from '../../lib/utils';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&q=80';

interface BookingCardProps {
  booking: ApiBooking;
  onCancel?: (id: number) => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, onCancel }) => {
  const status = booking.status.toLowerCase() as any;
  const isUpcoming = status === 'confirmed' || status === 'pending';
  const image = booking.rooms?.[0]?.image ?? null;

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden flex flex-col sm:flex-row">
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
            <h3 className="text-base font-bold text-gray-900">{booking.room_type} – Phòng {booking.room_number}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
            <Hash className="h-3 w-3" />
            Mã đặt phòng: <span className="font-medium text-gray-800">{booking.booking_id}</span>
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(booking.check_in)} – {formatDate(booking.check_out)}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end pt-4 border-t border-gray-100 mt-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Tổng tiền</p>
            <p className="font-bold text-blue-600">{formatVND(booking.total_price)}</p>
          </div>
          <div className="flex gap-2">
            {isUpcoming && onCancel && (
              <Button variant="danger" size="sm" onClick={() => onCancel(booking.booking_id)}>
                Hủy phòng
              </Button>
            )}
            <Button variant="outline" size="sm">Xem chi tiết</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
