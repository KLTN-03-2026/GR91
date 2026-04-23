import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Wifi, Wind, Tv, Coffee, ArrowRight, Bath, Waves, Dumbbell, Car } from 'lucide-react';
import type { Room } from '../../types';
import { formatVND, cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';

interface RoomCardProps {
  room: Room;
  /** 'list' = horizontal card (RoomList page), 'grid' = vertical card (Home page) */
  layout?: 'list' | 'grid';
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  'Wifi': <Wifi className="h-3.5 w-3.5" />,
  'Điều hòa': <Wind className="h-3.5 w-3.5" />,
  'TV': <Tv className="h-3.5 w-3.5" />,
  'Bữa sáng': <Coffee className="h-3.5 w-3.5" />,
  'Bồn tắm': <Bath className="h-3.5 w-3.5" />,
  'Hồ bơi': <Waves className="h-3.5 w-3.5" />,
  'Phòng gym': <Dumbbell className="h-3.5 w-3.5" />,
  'Đưa đón': <Car className="h-3.5 w-3.5" />,
};

export const RoomCard: React.FC<RoomCardProps> = ({ room, layout = 'list' }) => {
  // Common details derived safely
  const sizeText = room.size && room.size > 0 ? `${room.size}m²` : null;
  const capacityText = room.capacity && room.capacity !== '0 khách' && room.capacity !== '0 Khách' && room.capacity !== '0' ? `${room.capacity} Khách` : null;
  const bedText = room.bed ? room.bed : null;
  const details = [sizeText, capacityText, bedText].filter(Boolean).join(' • ');

  // Get max 4 amenities
  const displayAmenities = (room.amenities || []).slice(0, 4);

  if (layout === 'grid') {
    return (
      <Link
        to={room.room_id ? `/room/${room.room_id}` : `/rooms/${room.id}`}
        className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.1)] transition-all duration-300 group border border-gray-100 flex flex-col h-full"
      >
        {/* Thumbnail - 16:9 */}
        <div className="relative w-full aspect-video overflow-hidden">
          <img
            src={room.image || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'}
            alt={room.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
          {/* Overlay gradient for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          
          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
            {room.isPopular && (
              <Badge variant="blue" className="bg-blue-600 border-none text-white shadow-sm font-semibold tracking-wider text-[10px] px-2 py-0.5">
                POPULAR
              </Badge>
            )}
            {room.discount ? (
              <Badge variant="red" className="bg-red-500 border-none text-white shadow-sm font-semibold text-[10px] px-2 py-0.5">
                Giảm {room.discount}%
              </Badge>
            ) : null}
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
             <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/20">
               <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
               <span className="font-bold text-white text-xs">{room.rating ? room.rating.toFixed(1) : parseFloat("4.5").toFixed(1)}</span>
               <span className="text-gray-300 text-[10px]">({room.reviews > 0 ? room.reviews : 12})</span>
             </div>
             
             {room.roomCount && room.roomCount > 0 ? (
               <div className="bg-white/95 text-red-600 px-2 py-1 flex items-center justify-center rounded-lg shadow-sm">
                 <span className="text-[10px] font-bold">Còn {room.roomCount} phòng</span>
               </div>
             ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
            {room.name}
          </h3>
          
          {details && (
            <p className="text-gray-500 text-xs mb-3 font-medium tracking-wide truncate">
              {details}
            </p>
          )}

          {/* Amenities */}
          <div className="flex flex-wrap gap-1.5 mt-auto mb-4">
            {displayAmenities.map((am) => (
              <span key={am} className="inline-flex items-center justify-center bg-gray-50 text-gray-600 border border-gray-100 rounded-md h-7 px-2 tooltip text-[10px] font-medium" title={am}>
                {AMENITY_ICONS[am] || <span className="h-1 w-1 bg-gray-400 rounded-full inline-block" />}
                <span className="ml-1 hidden sm:inline-block truncate max-w-[60px]">{am}</span>
              </span>
            ))}
            {(room.amenities?.length || 0) > 4 && (
              <span className="inline-flex items-center justify-center bg-gray-50 text-gray-500 border border-gray-100 rounded-md h-7 px-2 text-[10px] font-medium">
                +{room.amenities.length - 4}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-auto border-t border-gray-100 pt-4">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-medium tracking-wide uppercase">Giá từ</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-extrabold text-blue-600">{formatVND(room.price)}</span>
                <span className="text-[10px] text-gray-500 font-medium">/đêm</span>
              </div>
            </div>
            
            <div className={cn(
               "h-10 w-10 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl",
               "group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm"
            )}>
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Horizontal List layout (preserved from original or lightly touched)
  return (
    <Link
      to={room.room_id ? `/room/${room.room_id}` : `/rooms/${room.id}`}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col md:flex-row hover:shadow-md transition-shadow group block"
    >
      <div className="md:w-2/5 h-56 md:h-auto relative shrink-0">
        <img
          src={room.image || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'}
          alt={room.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="font-bold text-xs">{room.rating ? room.rating.toFixed(1) : '4.5'}</span>
          <span className="text-gray-500 text-xs">({room.reviews || 12})</span>
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
          {details && (
            <p className="text-gray-500 text-sm mb-4">
              {details}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {room.amenities?.map((am) => (
              <span key={am} className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                {AMENITY_ICONS[am] || <span className="h-1 w-1 bg-gray-400 rounded-full" />} {am}
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
