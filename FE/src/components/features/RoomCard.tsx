import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Wifi, Wind, Tv, Coffee, ArrowRight } from 'lucide-react';
import type { Room } from '../../types';
import { formatVND } from '../../lib/utils';
import { Badge } from '../ui/Badge';

interface RoomCardProps {
  room: Room;
  /** 'list' = horizontal card (RoomList page), 'grid' = vertical card (Home page) */
  layout?: 'list' | 'grid';
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'Wifi': <Wifi className="h-3 w-3" />,
  'Điều hòa': <Wind className="h-3 w-3" />,
  'TV': <Tv className="h-3 w-3" />,
  'Bữa sáng': <Coffee className="h-3 w-3" />,
};

export const RoomCard: React.FC<RoomCardProps> = ({ room, layout = 'list' }) => {
  if (layout === 'grid') {
    return (
      <Link
        to={`/rooms/${room.id}`}
        className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group border border-gray-100 block"
      >
        <div className="relative h-52 overflow-hidden p-2">
          <img
            src={room.image}
            alt={room.name}
            className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          {room.isPopular && (
            <div className="absolute top-4 right-4">
              <Badge variant="blue" className="bg-white/95 text-gray-800 shadow-sm">POPULAR</Badge>
            </div>
          )}
          {room.discount && (
            <div className="absolute top-4 left-4">
              <Badge variant="red">-{room.discount}%</Badge>
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="text-base font-bold text-gray-900 mb-1">{room.name}</h3>
          <p className="text-gray-500 text-xs mb-3">{room.size}m² · {room.bed}</p>
          <div className="flex justify-between items-end pt-3 border-t border-gray-50">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">GIÁ TỪ</p>
              <p className="text-lg font-bold text-gray-900">
                {formatVND(room.price)}<span className="text-xs font-normal text-gray-500">/đêm</span>
              </p>
            </div>
            <span className="bg-blue-50 text-blue-600 p-2 rounded-full group-hover:bg-blue-100 transition-colors">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // List layout
  return (
    <Link
      to={`/rooms/${room.id}`}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col md:flex-row hover:shadow-md transition-shadow group block"
    >
      <div className="md:w-2/5 h-56 md:h-auto relative shrink-0">
        <img
          src={room.image}
          alt={room.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="font-bold text-xs">{room.rating}</span>
          <span className="text-gray-500 text-xs">({room.reviews})</span>
        </div>
        {room.discount && (
          <div className="absolute top-3 right-3">
            <Badge variant="red">-{room.discount}%</Badge>
          </div>
        )}
      </div>

      <div className="p-5 md:p-6 flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900">{room.name}</h2>
            <Badge variant="gray">{room.type}</Badge>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Sức chứa: {room.capacity}
            {room.bed && <span className="ml-2 text-gray-400">· {room.bed}</span>}
          </p>

          <div className="flex flex-wrap gap-2">
            {Object.entries(AMENITY_ICONS).map(([label, icon]) => (
              <span key={label} className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                {icon} {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-end pt-4 border-t border-gray-100 mt-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Giá mỗi đêm từ</p>
            <span className="text-2xl font-bold text-blue-600">{formatVND(room.price)}</span>
          </div>
          <span className="bg-gray-900 group-hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Xem chi tiết
          </span>
        </div>
      </div>
    </Link>
  );
};
