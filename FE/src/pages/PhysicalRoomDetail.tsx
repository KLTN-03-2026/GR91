import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Star, Users, BedDouble, CheckCircle, AlertTriangle, Info,
  ChevronLeft, ChevronRight, Loader2, X, Shield, Maximize2,
  ArrowRight, Layers, Clock, Wrench, CalendarX, Calendar, DollarSign,
  TrendingUp, Ruler, Tag, MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatVND } from '../lib/utils';
import { SERVICE_FEE_RATE, VAT_RATE } from '../lib/constants';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import {
  publicRoomApi, adminRoomApi, reviewApi,
  type PhysicalRoomDetail as PhysicalRoomData,
  type ApiReview, type PriceRangeDay, type RoomAvailabilityDay, type RoomAvailabilityRange,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { redirectToLogin } from '../lib/redirectToLogin';

// ─── Constants ────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];
const FALLBACK = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PricingRule {
  rule_id: number;
  rule_type: 'checkin' | 'checkout';
  start_hour: number;
  end_hour: number;
  percent: number;
  description: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avgRating(reviews: ApiReview[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

const StarRow = memo(({ value, max = 5, size = 'sm' }: { value: number; max?: number; size?: 'sm' | 'md' }) => {
  const cls = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </span>
  );
});

function calcFeeFromRules(rules: PricingRule[], type: 'checkin' | 'checkout', timeStr: string, base: number): number {
  if (!timeStr) return 0;
  const h = parseInt(timeStr.split(':')[0], 10);
  const r = rules.find((r) => r.rule_type === type && h >= r.start_hour && h < r.end_hour);
  return r ? Math.round(base * (r.percent / 100)) : 0;
}

function getFeeLabel(rules: PricingRule[], type: 'checkin' | 'checkout', timeStr: string): string {
  if (!timeStr) return '';
  const h = parseInt(timeStr.split(':')[0], 10);
  const r = rules.find((r) => r.rule_type === type && h >= r.start_hour && h < r.end_hour);
  return r ? `+${r.percent}%` : '';
}

function addDays(dateStr: string, days: number): string {
  try {
    const next = new Date(`${dateStr}T00:00:00`);
    if (isNaN(next.getTime())) return dateStr;
    next.setDate(next.getDate() + days);
    return next.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatCalendarLabel(date: Date): string {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}

function listCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: date.toISOString().split('T')[0],
      date,
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function enumerateRange(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut || checkIn >= checkOut) return [];
  const days: string[] = [];
  let cursor = checkIn;
  let safety = 0;
  while (cursor < checkOut && safety < 100) { // Limit to 100 days for safety
    days.push(cursor);
    cursor = addDays(cursor, 1);
    safety++;
  }
  return days;
}

function rangeHasBlockedDays(disabledDates: Set<string>, checkIn: string, checkOut: string): boolean {
  return enumerateRange(checkIn, checkOut).some((date) => disabledDates.has(date));
}

function formatRangeDisplay(checkIn: string, checkOut: string): string {
  const start = new Date(`${checkIn}T00:00:00`).toLocaleDateString('vi-VN');
  const endExclusive = new Date(`${checkOut}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() - 1);
  const end = endExclusive.toLocaleDateString('vi-VN');
  return `${start} → ${end}`;
}

// ─── Price Source Badge ───────────────────────────────────────────────────────
const PriceSourceBadge = memo(({ row }: { row: PriceRangeDay }) => {
  if (row.room_price != null)
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-medium">Room</span>;
  if (row.type_price != null)
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">Type</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 border border-gray-200">Base</span>;
});

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = memo(({ images, index, onClose, onChange }: {
  images: string[]; index: number; onClose: () => void; onChange: (i: number) => void;
}) => {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  onChange((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') onChange((index + 1) % images.length);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [index, images.length, onClose, onChange]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors" onClick={onClose}>
        <X className="h-7 w-7" />
      </button>
      <button className="absolute left-5 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 p-3 rounded-full text-white transition-colors"
        onClick={(e) => { e.stopPropagation(); onChange((index - 1 + images.length) % images.length); }}>
        <ChevronLeft className="h-6 w-6" />
      </button>
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl" referrerPolicy="no-referrer" />
      <button className="absolute right-5 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 p-3 rounded-full text-white transition-colors"
        onClick={(e) => { e.stopPropagation(); onChange((index + 1) % images.length); }}>
        <ChevronRight className="h-6 w-6" />
      </button>
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 text-sm px-4 py-1.5 rounded-full backdrop-blur-sm">
        {index + 1} / {images.length}
      </div>
    </div>
  );
});

// ─── Similar Room Carousel ────────────────────────────────────────────────────
const SimilarCarousel = memo(({ rooms, currentRoomId }: { rooms: any[]; currentRoomId: string | undefined }) => {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (ref.current) ref.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const ordered = useMemo(() => {
    const sameType = rooms.filter((r) => !r.is_upsell);
    const upsell   = rooms.filter((r) => r.is_upsell);
    return [...sameType, ...upsell];
  }, [rooms]);

  if (ordered.length === 0) return (
    <p className="text-gray-500 bg-white p-6 rounded-2xl text-center border border-gray-100">
      Hiện không còn phòng tương tự nào trống trong khoảng thời gian này.
    </p>
  );

  return (
    <div className="relative">
      {ordered.length > 3 && (
        <>
          <button onClick={() => scroll('left')} className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button onClick={() => scroll('right')} className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </>
      )}
      <div ref={ref} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-hide">
        {ordered.map((sr, i) => (
          <motion.div key={sr.room_id}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex-none w-64 bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition duration-300 overflow-hidden flex flex-col">
            <div className="relative h-40 overflow-hidden group">
              {sr.image
                ? <img src={sr.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="Room" referrerPolicy="no-referrer" />
                : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">Không có ảnh</div>}
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-blue-700 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Tầng {sr.floor}
              </div>
              {sr.is_upsell && (
                <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NÂNG CẤP</div>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <p className="font-bold text-gray-900 text-sm mb-0.5">Phòng {sr.room_number}</p>
              <p className="text-xs text-gray-500 mb-2">{sr.type_name}</p>
              {sr.is_upsell && sr.price_diff > 0 && (
                <p className="text-xs text-amber-600 font-medium mb-2">Chỉ thêm {formatVND(sr.price_diff)} để nâng cấp</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                <span className="text-base font-black text-blue-600">{formatVND(sr.effective_price)}</span>
                <Link to={`/room/${sr.room_id}`} onClick={() => window.scrollTo(0, 0)}
                  className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

// ─── Section wrapper ──────────────────────────────────────────────────────────
const Section = memo(({ title, icon: Icon, children, className = '' }: {
  title: string; icon?: any; children: React.ReactNode; className?: string;
}) => {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-blue-500" />}
        {title}
      </h2>
      {children}
    </div>
  );
});

const AvailabilityCalendar = memo(({
  month,
  selectedStart,
  selectedEnd,
  disabledDates,
  statusByDate,
  onSelect,
}: {
  month: Date;
  selectedStart: string;
  selectedEnd: string;
  disabledDates: Set<string>;
  statusByDate: Map<string, RoomAvailabilityDay['status']>;
  onSelect: (date: string) => void;
}) => {
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const days = useMemo(() => listCalendarDays(month), [month]);

  const handleMouseEnter = (key: string) => {
    if (selectedStart && !selectedEnd) {
      setHoverDate(key);
    }
  };

  const handleMouseLeave = () => {
    setHoverDate(null);
  };

  return (
    <div className="rounded-2xl border border-gray-100 p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{formatCalendarLabel(month)}</h3>
        <div className="text-[11px] text-gray-400">Chọn ngày nhận và trả phòng</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-gray-400 mb-2">
        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label) => (
          <div key={label} className="text-center py-1">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ key, date, inMonth }) => {
          const isPast = key < TODAY;
          const status = statusByDate.get(key) ?? 'AVAILABLE';
          const isDisabled = !inMonth || isPast || disabledDates.has(key);
          const isInRange = !!selectedStart && !!selectedEnd && key >= selectedStart && key < selectedEnd;
          const isHoverRange = !!selectedStart && !selectedEnd && hoverDate && key > selectedStart && key <= hoverDate;
          const isStart = selectedStart === key;
          const isEnd = selectedEnd === key;
          const statusClass =
            status === 'BOOKED' || status === 'BLOCKED'
              ? 'bg-red-50 text-red-600 border-red-200'
              : status === 'PENDING'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-white text-gray-800 border-gray-200 hover:border-blue-400 hover:bg-blue-50';

          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(key)}
              onMouseEnter={() => handleMouseEnter(key)}
              onMouseLeave={handleMouseLeave}
              className={[
                'aspect-square rounded-xl border text-sm font-semibold transition-all duration-150 relative',
                !inMonth ? 'opacity-30 cursor-default' : '',
                isDisabled && inMonth ? statusClass : '',
                !isDisabled ? statusClass : '',
                isInRange ? 'ring-1 ring-blue-200 bg-blue-50 text-blue-700 border-blue-200 z-0' : '',
                isHoverRange && !isDisabled ? 'bg-blue-50/70 border-blue-200 text-blue-600' : '',
                isStart || isEnd ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-100 z-10 scale-105' : '',
              ].join(' ')}
              title={isDisabled && inMonth ? `${key} • ${status}` : key}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────
export function PhysicalRoomDetail() {
  const { room_id } = useParams<{ room_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  // Data
  const [room, setRoom]                         = useState<PhysicalRoomData | null>(null);
  const [reviews, setReviews]                   = useState<ApiReview[]>([]);
  const [availabilityDays, setAvailabilityDays] = useState<RoomAvailabilityDay[]>([]);
  const [bookedRanges, setBookedRanges]         = useState<RoomAvailabilityRange[]>([]);
  const [priceData, setPriceData]               = useState<PriceRangeDay[]>([]);
  const [apiSubtotal, setApiSubtotal]           = useState(0);
  const [similarRooms, setSimilarRooms]         = useState<any[]>([]);
  const [pricingRules, setPricingRules]         = useState<PricingRule[]>([]);

  // UI
  const [loading, setLoading]           = useState(true);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx]   = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));

  // Form
  const [dates, setDates] = useState({ checkIn: '', checkOut: '' });
  const [checkInTime, setCheckInTime]   = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');

  const { checkIn, checkOut } = dates;

  const disabledDates = useMemo(
    () => new Set(availabilityDays.filter((day) => day.status !== 'AVAILABLE').map((day) => day.date)),
    [availabilityDays]
  );
  const statusByDate = useMemo(
    () => new Map(availabilityDays.map((day) => [day.date, day.status] as const)),
    [availabilityDays]
  );

  const datesSelected = !!(checkIn && checkOut);
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const d = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000;
    return d > 0 ? Math.round(d) : 0;
  }, [checkIn, checkOut]);

  const hasConflict = useMemo(
    () => datesSelected ? rangeHasBlockedDays(disabledDates, checkIn, checkOut) : false,
    [disabledDates, checkIn, checkOut, datesSelected]
  );
  const isFullyBooked = useMemo(
    () => availabilityDays.length > 0 && availabilityDays.every((day) => day.status !== 'AVAILABLE'),
    [availabilityDays]
  );

  const effectiveBasePrice = room?.effective_price ?? room?.base_price ?? 0;
  const earlyFee  = useMemo(() => calcFeeFromRules(pricingRules, 'checkin',  checkInTime,  effectiveBasePrice), [pricingRules, checkInTime, effectiveBasePrice]);
  const lateFee   = useMemo(() => calcFeeFromRules(pricingRules, 'checkout', checkOutTime, effectiveBasePrice), [pricingRules, checkOutTime, effectiveBasePrice]);
  const subtotal  = datesSelected && apiSubtotal > 0 ? apiSubtotal : effectiveBasePrice * nights;
  const svcFee    = Math.round(subtotal * SERVICE_FEE_RATE);
  const vat       = Math.round(subtotal * VAT_RATE);
  const total     = subtotal + svcFee + vat + earlyFee + lateFee;
  const canBook   = datesSelected && nights > 0 && !hasConflict
    && room?.status !== 'MAINTENANCE' && room?.status !== 'INACTIVE';

  const images = useMemo(() => {
    if (!room) return [FALLBACK];
    const imgs = [room.image, ...(room.extra_images ?? []), ...(room.images ?? [])].filter(Boolean) as string[];
    return imgs.length ? [...new Set(imgs)] : [FALLBACK];
  }, [room]);

  // Fetches
  const fetchRoom = useCallback(async () => {
    if (!room_id) return;
    setLoading(true); setError(null);
    try {
      const [data, unavail, rules] = await Promise.all([
        publicRoomApi.getPhysicalDetail(room_id),
        publicRoomApi.getAvailability(room_id),
        publicRoomApi.getPricingRules(),
      ]);
      setRoom(data);
      if (data?.type_id) {
        sessionStorage.setItem('current_room_type_id', String(data.type_id));
      }
      setLoadingAvailability(true);
      setAvailabilityDays(Array.isArray(unavail?.data) ? unavail.data : []);
      setBookedRanges(Array.isArray(unavail?.booked_ranges) ? unavail.booked_ranges : []);
      setPricingRules(rules ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Không thể tải thông tin phòng');
    } finally {
      setLoadingAvailability(false);
      setLoading(false);
    }
  }, [room_id]);

  const fetchPriceRange = useCallback(async () => {
    if (!room_id || !checkIn || !checkOut || checkIn >= checkOut) {
      setPriceData([]); setApiSubtotal(0); return;
    }
    setLoadingPrice(true);
    try {
      const res = await publicRoomApi.getPriceRange(Number(room_id), checkIn, checkOut);
      setPriceData(res.data ?? []); setApiSubtotal(res.subtotal ?? 0);
    } catch { setPriceData([]); setApiSubtotal(0); }
    finally { setLoadingPrice(false); }
  }, [room_id, checkIn, checkOut]);

  const fetchSimilar = useCallback(async () => {
    if (!room_id) return;
    try {
      const data = await publicRoomApi.getSimilarRooms(room_id, { check_in: checkIn, check_out: checkOut });
      setSimilarRooms(data ?? []);
    } catch { setSimilarRooms([]); }
  }, [room_id, checkIn, checkOut]);

  const fetchReviews = useCallback(async () => {
    if (!room?.type_id) return;
    try { setReviews((await reviewApi.list(room.type_id)) ?? []); }
    catch { setReviews([]); }
  }, [room?.type_id]);

  useEffect(() => { fetchRoom(); },     [fetchRoom]);
  useEffect(() => { 
    const timer = setTimeout(() => fetchPriceRange(), 300);
    return () => clearTimeout(timer);
  }, [fetchPriceRange]);
  useEffect(() => { 
    const timer = setTimeout(() => fetchSimilar(), 500);
    return () => clearTimeout(timer);
  }, [fetchSimilar]);
  useEffect(() => { fetchReviews(); },  [fetchReviews]);

  useEffect(() => {
    return () => { sessionStorage.removeItem('current_room_type_id'); };
  }, [room_id]);

  const handleCalendarSelect = useCallback((date: string) => {
    setSelectionError('');

    setDates((prev) => {
      // Nếu click trùng ngày Check-in đã chọn -> Bỏ chọn hoàn toàn (Deselect)
      if (date === prev.checkIn) {
        return { checkIn: '', checkOut: '' };
      }

      // Nếu click trùng ngày Check-out đã chọn -> Bỏ chọn Check-out
      if (date === prev.checkOut) {
        return { ...prev, checkOut: '' };
      }

      // Nếu chưa chọn hoặc đã chọn xong 1 khoảng hoặc chọn ngày trước ngày bắt đầu cũ -> chọn lại check-in
      if (!prev.checkIn || (prev.checkIn && prev.checkOut) || date < prev.checkIn) {
        return { checkIn: date, checkOut: '' };
      }

      // Kiểm tra xem khoảng giữa có ngày nào bị khóa không
      if (rangeHasBlockedDays(disabledDates, prev.checkIn, date)) {
        const message = 'Khoảng thời gian này đã có ngày bị đặt';
        setSelectionError(message);
        toast(message, 'error');
        return { ...prev, checkOut: '' };
      }

      return { ...prev, checkOut: date };
    });
  }, [disabledDates, toast]);

  const handleBook = useCallback(() => {
    if (!user) { redirectToLogin(navigate, location); return; }
    if (hasConflict) {
      toast('Khoảng thời gian bạn chọn đã có người đặt', 'error');
      return;
    }
    if (!canBook || !room) return;
    navigate('/checkout', {
      state: {
        room_id: room.room_id, room_number: room.room_number,
        type_name: room.type_name, image: images[0],
        check_in: checkIn, check_out: checkOut,
        check_in_time: checkInTime, check_out_time: checkOutTime,
        nights, base_price: effectiveBasePrice, subtotal,
        early_checkin_fee: earlyFee, late_checkout_fee: lateFee,
        service_fee: svcFee, vat, total,
      },
    });
  }, [user, hasConflict, canBook, room, navigate, location, images, checkIn, checkOut, checkInTime, checkOutTime, nights, effectiveBasePrice, subtotal, earlyFee, lateFee, svcFee, vat, total, toast]);

  const bookLabel = useMemo(() => {
    if (!datesSelected)                return 'Chọn ngày để đặt phòng';
    if (nights === 0)                  return 'Ngày không hợp lệ';
    if (room?.status === 'MAINTENANCE') return 'Phòng đang bảo trì';
    if (room?.status === 'INACTIVE')   return 'Phòng tạm ngưng';
    if (hasConflict)                   return 'Phòng đã được đặt';
    return 'Đặt phòng ngay';
  }, [datesSelected, nights, room?.status, hasConflict]);

  // ── States ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
    </div>
  );
  if (error || !room) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4 bg-gray-50">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <p className="text-gray-600">{error ?? 'Không tìm thấy phòng'}</p>
      <Button onClick={() => navigate(-1)}>Quay lại</Button>
    </div>
  );

  const avg = avgRating(reviews);

  return (
    <div className="min-h-screen bg-gray-50">
      {lightboxOpen && (
        <Lightbox images={images} index={lightboxIdx}
          onClose={() => setLightboxOpen(false)} onChange={setLightboxIdx} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
          <Link to="/" className="hover:text-blue-600 transition-colors">Trang chủ</Link>
          <span>/</span>
          <Link to="/rooms" className="hover:text-blue-600 transition-colors">Phòng</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Phòng {room.room_number}</span>
        </div>

        {/* ── Title Row ── */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">{room.type_name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-500">
              {avg > 0 && (
                <span className="flex items-center gap-1 font-semibold text-gray-800">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  {avg.toFixed(1)}
                  <span className="font-normal text-gray-400">({reviews.length})</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-gray-400" /> Tầng {room.floor}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-gray-400" /> {room.capacity} khách
              </span>
              {room.area_sqm && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5 text-gray-400" /> {room.area_sqm} m²
                </span>
              )}
              {room.category_name && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-gray-400" /> {room.category_name}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-blue-600">{formatVND(effectiveBasePrice)}</p>
            <p className="text-xs text-gray-400">/ đêm (chưa VAT)</p>
            {room.override_price && <p className="text-xs text-orange-500 mt-0.5">Giá đặc biệt hôm nay</p>}
          </div>
        </div>

        {/* GALLERY */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2.5 h-[420px] md:h-[500px] rounded-2xl overflow-hidden mb-10 relative">
          <div className="col-span-2 row-span-2 relative group cursor-pointer overflow-hidden"
            onClick={() => { setLightboxIdx(0); setLightboxOpen(true); }}>
            <img src={images[0]} alt={room.room_number}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
              referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>

          {[1, 2, 3, 4].map((i) => {
            const src = images[i] ?? null;
            const isLast = i === 4;
            return (
              <div key={i}
                className={`relative overflow-hidden cursor-pointer group ${src ? '' : 'bg-gray-100'}`}
                onClick={() => { if (src) { setLightboxIdx(i); setLightboxOpen(true); } }}>
                {src ? (
                  <>
                    <img src={src} alt={`Ảnh ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                      referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
                    {isLast && images.length > 5 && (
                      <button
                        className="absolute inset-0 flex items-center justify-center bg-black/45 text-white hover:bg-black/55 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setLightboxIdx(0); setLightboxOpen(true); }}>
                        <div className="text-center">
                          <Maximize2 className="h-5 w-5 mx-auto mb-1" />
                          <span className="text-sm font-semibold">+{images.length - 5} ảnh</span>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-300 text-xs">Không có ảnh</span>
                  </div>
                )}
              </div>
            );
          })}

          {images.length > 1 && images.length <= 5 && (
            <button
              className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 hover:bg-white transition-colors border border-white/60"
              onClick={() => { setLightboxIdx(0); setLightboxOpen(true); }}>
              <Maximize2 className="h-3.5 w-3.5" /> Xem tất cả {images.length} ảnh
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            <div className="flex flex-wrap gap-2">
              {room.status === 'MAINTENANCE' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200">
                  <Wrench className="h-3.5 w-3.5" /> Đang bảo trì
                </span>
              )}
              {room.status === 'CLEANING' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full border border-yellow-200">
                  <Clock className="h-3.5 w-3.5" /> Đang dọn phòng
                </span>
              )}
              {datesSelected && hasConflict && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 px-3 py-1.5 rounded-full border border-red-200">
                  <CalendarX className="h-3.5 w-3.5" /> Hết phòng giai đoạn này
                </span>
              )}
              {isFullyBooked && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 px-3 py-1.5 rounded-full border border-red-200">
                  <CalendarX className="h-3.5 w-3.5" /> Phòng đang kín lịch sắp tới
                </span>
              )}
              {datesSelected && !hasConflict && room.status === 'ACTIVE' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-200">
                  <CheckCircle className="h-3.5 w-3.5" /> Sẵn sàng đặt
                </span>
              )}
              {!datesSelected && room.status === 'ACTIVE' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200">
                  <Info className="h-3.5 w-3.5" /> Sẵn sàng · Chọn ngày để xem lịch
                </span>
              )}
            </div>

            {room.beds && room.beds.length > 0 && (
              <Section title="Cấu hình giường" icon={BedDouble}>
                <div className="flex flex-wrap gap-3">
                  {room.beds.map((b, i) => (
                    <div key={i} className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <BedDouble className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{b.quantity}x {b.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {room.amenities && room.amenities.length > 0 && (
              <Section title="Tiện nghi phòng" icon={CheckCircle}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                  {room.amenities.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      {a}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {room.description && (
              <Section title="Mô tả">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{room.description}</p>
              </Section>
            )}

            {datesSelected && (
              <Section title="Chi tiết giá theo ngày" icon={TrendingUp}>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-100 mb-4">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300 inline-block" />Base: giá gốc</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-100 border border-purple-300 inline-block" />Type: theo loại phòng</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-300 inline-block" />Room: riêng phòng này</span>
                </div>

                {loadingPrice ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
                ) : priceData.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Không thể tải chi tiết giá.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                            <th className="px-4 py-3 font-medium">Ngày</th>
                            <th className="px-4 py-3 font-medium">Base</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Room</th>
                            <th className="px-4 py-3 font-medium text-right">Giá hiệu lực</th>
                            <th className="px-4 py-3 font-medium">Nguồn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {priceData.map((row) => (
                            <tr key={row.date}
                              className={`text-sm ${row.room_price != null ? 'bg-orange-50/40' : row.type_price != null ? 'bg-purple-50/30' : ''}`}>
                              <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                                {new Date(row.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </td>
                              <td className="px-4 py-2.5 text-gray-500">{formatVND(row.base_price)}</td>
                              <td className="px-4 py-2.5">
                                {row.type_price != null ? <span className="text-purple-700 font-medium">{formatVND(row.type_price)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                {row.room_price != null ? <span className="text-orange-700 font-medium">{formatVND(row.room_price)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-gray-900">{formatVND(row.final_price)}</td>
                              <td className="px-4 py-2.5"><PriceSourceBadge row={row} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex justify-end pr-1">
                      <span className="text-sm text-gray-500">
                        Tổng {nights} đêm: <strong className="text-blue-600 text-base ml-1">{formatVND(apiSubtotal)}</strong>
                      </span>
                    </div>
                  </>
                )}
              </Section>
            )}

            {datesSelected && hasConflict && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Phòng không khả dụng trong khoảng này</p>
                  <p className="text-xs mt-0.5 text-red-500">Vui lòng chọn khoảng ngày khác hoặc xem phòng tương tự bên dưới.</p>
                </div>
              </div>
            )}

            <Section title="Lịch phòng" icon={Calendar}>
              {loadingAvailability ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border border-gray-300" /> Trống</span>
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /> Đang giữ chỗ</span>
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Đã đặt</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mx-auto" />
                    </button>
                    <div className="text-sm font-semibold text-gray-700">
                      {checkIn ? `Nhận phòng: ${new Date(`${checkIn}T00:00:00`).toLocaleDateString('vi-VN')}` : 'Chọn ngày nhận phòng'}
                      {checkOut ? ` • Trả phòng: ${new Date(`${checkOut}T00:00:00`).toLocaleDateString('vi-VN')}` : ''}
                    </div>
                    <button
                      type="button"
                      className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    >
                      <ChevronRight className="h-4 w-4 mx-auto" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <AvailabilityCalendar
                      month={calendarMonth}
                      selectedStart={checkIn}
                      selectedEnd={checkOut}
                      disabledDates={disabledDates}
                      statusByDate={statusByDate}
                      onSelect={handleCalendarSelect}
                    />
                    <AvailabilityCalendar
                      month={new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)}
                      selectedStart={checkIn}
                      selectedEnd={checkOut}
                      disabledDates={disabledDates}
                      statusByDate={statusByDate}
                      onSelect={handleCalendarSelect}
                    />
                  </div>

                  {selectionError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {selectionError}
                    </div>
                  )}

                  {bookedRanges.length > 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Phòng đã được đặt hoặc giữ chỗ vào các ngày:</p>
                      <div className="space-y-2 text-sm text-gray-600">
                        {bookedRanges.slice(0, 8).map((range, index) => (
                          <div key={`${range.check_in}-${range.check_out}-${index}`} className="flex items-center justify-between gap-3">
                            <span>{formatRangeDisplay(range.check_in, range.check_out)}</span>
                            <Badge className={range.status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}>
                              {range.status === 'PENDING' ? 'PENDING' : 'BOOKED'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-700">
                      Phòng hiện chưa có ngày bị khóa trong lịch sắp tới.
                    </div>
                  )}
                </div>
              )}
            </Section>

            <Section title="Chính sách" icon={Shield}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-2.5 bg-blue-50/60 rounded-xl px-4 py-3">
                  <Info className="h-4 w-4 text-blue-400 shrink-0" />
                  <span>Nhận phòng: từ <strong>14:00</strong></span>
                </div>
                <div className="flex items-center gap-2.5 bg-blue-50/60 rounded-xl px-4 py-3">
                  <Info className="h-4 w-4 text-blue-400 shrink-0" />
                  <span>Trả phòng: trước <strong>11:00</strong></span>
                </div>
                {pricingRules.map((r) => (
                  <div key={r.rule_id} className="flex items-center gap-2.5 bg-amber-50 rounded-xl px-4 py-3 sm:col-span-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>{r.description} <span className="text-amber-600 font-semibold">(+{r.percent}%)</span></span>
                  </div>
                ))}
              </div>
            </Section>

            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <span className="flex items-center gap-1.5 text-xl font-black text-gray-900">
                    <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                    {avg.toFixed(1)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{reviews.length} đánh giá</p>
                    <StarRow value={avg} size="md" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviews.slice(0, 6).map((rv) => (
                    <div key={rv.review_id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {rv.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{rv.full_name ?? 'Khách'}</span>
                        </div>
                        <StarRow value={rv.rating} />
                      </div>
                      {rv.comment && <p className="text-xs text-gray-600 leading-relaxed">{rv.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(similarRooms.length > 0 || hasConflict || isFullyBooked) && (
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-4">Phòng tương tự</h2>
                <SimilarCarousel rooms={similarRooms} currentRoomId={room_id} />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Booking Card */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">

                <div className="mb-5 pb-4 border-b border-gray-100">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-gray-900">{formatVND(effectiveBasePrice)}</span>
                    <span className="text-sm text-gray-400">/ đêm</span>
                  </div>
                  {avg > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                      <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="font-semibold text-gray-700">{avg.toFixed(1)}</span>
                      <span>· {reviews.length} đánh giá</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 overflow-hidden mb-3">
                  <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="p-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Nhận phòng</label>
                      <div className="text-sm font-medium text-gray-800">{checkIn ? new Date(`${checkIn}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa chọn'}</div>
                    </div>
                    <div className="p-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Trả phòng</label>
                      <div className="text-sm font-medium text-gray-800">{checkOut ? new Date(`${checkOut}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa chọn'}</div>
                    </div>
                  </div>
                </div>

                {pricingRules.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5 mb-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        Giờ nhận {getFeeLabel(pricingRules, 'checkin', checkInTime) && <span className="text-amber-500 normal-case font-semibold">{getFeeLabel(pricingRules, 'checkin', checkInTime)}</span>}
                      </label>
                      <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        Giờ trả {getFeeLabel(pricingRules, 'checkout', checkOutTime) && <span className="text-amber-500 normal-case font-semibold">{getFeeLabel(pricingRules, 'checkout', checkOutTime)}</span>}
                      </label>
                      <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                    </div>
                  </div>
                )}

                {datesSelected && hasConflict && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5 mb-3">
                    <CalendarX className="h-3.5 w-3.5 shrink-0" />
                    Phòng đã được đặt trong khoảng thời gian này
                  </div>
                )}
                {!datesSelected && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl px-3 py-2.5 mb-3">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Chọn ngày trực tiếp trên lịch ở cột bên trái để tiếp tục.
                  </div>
                )}

                {datesSelected && nights > 0 && !hasConflict && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
                    {loadingPrice ? (
                      <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600">
                          <span>
                            {priceData.length > 0
                              ? `Giá thực tế (${nights} đêm)`
                              : `${formatVND(effectiveBasePrice)} × ${nights} đêm`}
                          </span>
                          <span>{formatVND(subtotal)}</span>
                        </div>
                        {earlyFee > 0 && (
                          <div className="flex justify-between text-amber-600 text-xs">
                            <span>Phí nhận phòng sớm</span>
                            <span>+{formatVND(earlyFee)}</span>
                          </div>
                        )}
                        {lateFee > 0 && (
                          <div className="flex justify-between text-amber-600 text-xs">
                            <span>Phí trả phòng muộn</span>
                            <span>+{formatVND(lateFee)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-gray-500 text-xs">
                          <span>Phí dịch vụ ({(SERVICE_FEE_RATE * 100).toFixed(0)}%)</span>
                          <span>{formatVND(svcFee)}</span>
                        </div>
                        <div className="flex justify-between text-gray-500 text-xs">
                          <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                          <span>{formatVND(vat)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 pt-2.5 border-t border-gray-200 mt-1">
                          <span>Tổng cộng</span>
                          <span className="text-blue-600 text-base">{formatVND(total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  disabled={!canBook}
                  onClick={handleBook}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                    canBook
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg active:scale-[0.98]'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}>
                  {bookLabel}
                </button>

                {!user && datesSelected && (
                  <p className="text-xs text-center text-gray-400 mt-3">
                    Bạn cần <Link to="/login" state={{ from: location.pathname }} className="text-blue-500 hover:underline">đăng nhập</Link> để đặt phòng
                  </p>
                )}

                {room.room_note && (
                  <div className="mt-4 flex items-start gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {room.room_note}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-green-500" /> Bảo mật</span>
                  <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Hoàn tiền 48h</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
