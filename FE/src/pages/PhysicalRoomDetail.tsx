import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star, Users, BedDouble, CheckCircle, AlertTriangle, Info,
  ChevronLeft, ChevronRight, Loader2, X, Shield, Maximize2,
  ArrowRight, Layers, Clock, Wrench, CalendarX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatVND } from '../lib/utils';
import { SERVICE_FEE_RATE, VAT_RATE } from '../lib/constants';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  publicRoomApi, reviewApi,
  type PhysicalRoomDetail as PhysicalRoomData,
  type ApiReview,
} from '../lib/api';
import { useAuth } from '../lib/auth';

const TODAY = new Date().toISOString().split('T')[0];
const FALLBACK = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PricingRule {
  rule_id: number;
  rule_type: 'checkin' | 'checkout';
  start_hour: number;
  end_hour: number;
  percent: number;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function avgRating(reviews: ApiReview[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </span>
  );
}

/** Tính phí từ pricing_rules dựa trên giờ */
function calcFeeFromRules(
  rules: PricingRule[],
  type: 'checkin' | 'checkout',
  timeStr: string,
  basePerNight: number,
): number {
  if (!timeStr) return 0;
  const h = parseInt(timeStr.split(':')[0], 10);
  const matched = rules.find(
    (r) => r.rule_type === type && h >= r.start_hour && h < r.end_hour
  );
  return matched ? Math.round(basePerNight * (matched.percent / 100)) : 0;
}

/** Lấy label phí từ rules */
function getFeeLabel(rules: PricingRule[], type: 'checkin' | 'checkout', timeStr: string): string {
  if (!timeStr) return '';
  const h = parseInt(timeStr.split(':')[0], 10);
  const matched = rules.find((r) => r.rule_type === type && h >= r.start_hour && h < r.end_hour);
  return matched ? `+${matched.percent}%` : '';
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ images, index, onClose, onChange }: {
  images: string[]; index: number; onClose: () => void; onChange: (i: number) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  onChange((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') onChange((index + 1) % images.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [index, images.length, onClose, onChange]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={onClose}>
        <X className="h-7 w-7" />
      </button>
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white"
        onClick={(e) => { e.stopPropagation(); onChange((index - 1 + images.length) % images.length); }}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        referrerPolicy="no-referrer" />
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white"
        onClick={(e) => { e.stopPropagation(); onChange((index + 1) % images.length); }}
      >
        <ChevronRight className="h-6 w-6" />
      </button>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

// ── Availability Badge ────────────────────────────────────────────────────────
function AvailBadge({ status, datesSelected }: { status: string; datesSelected: boolean }) {
  if (status === 'MAINTENANCE') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">
      <Wrench className="h-3.5 w-3.5" /> Đang bảo trì
    </span>
  );
  if (status === 'CLEANING') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full">
      <Clock className="h-3.5 w-3.5" /> Đang dọn phòng
    </span>
  );
  if (!datesSelected) return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
      <Info className="h-3.5 w-3.5" /> Sẵn sàng · Chọn ngày để xem lịch
    </span>
  );
  if (status === 'BOOKED') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-600 px-3 py-1.5 rounded-full">
      <CalendarX className="h-3.5 w-3.5" /> Hết phòng giai đoạn này
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
      <CheckCircle className="h-3.5 w-3.5" /> Sẵn sàng đặt
    </span>
  );
}

// ── Similar Room Carousel ─────────────────────────────────────────────────────
function SimilarCarousel({ rooms, currentRoomId }: { rooms: any[]; currentRoomId: string | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (ref.current) ref.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const sameType  = rooms.filter((r) => !r.is_upsell);
  const upsell    = rooms.filter((r) => r.is_upsell);
  const ordered   = [...sameType, ...upsell];

  if (ordered.length === 0) return (
    <p className="text-gray-500 bg-white p-6 rounded-2xl text-center border border-gray-100">
      Hiện không còn phòng tương tự nào trống trong khoảng thời gian này.
    </p>
  );

  return (
    <div className="relative">
      {ordered.length > 3 && (
        <>
          <button onClick={() => scroll('left')}
            className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button onClick={() => scroll('right')}
            className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </>
      )}
      <div ref={ref} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-hide">
        {ordered.map((sr, i) => (
          <motion.div key={sr.room_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="flex-none w-64 bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition duration-300 overflow-hidden flex flex-col"
          >
            <div className="relative h-40 overflow-hidden group">
              {sr.image
                ? <img src={sr.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" alt="Room" referrerPolicy="no-referrer" />
                : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">Không có ảnh</div>
              }
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-blue-700 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Tầng {sr.floor}
              </div>
              {sr.is_upsell && (
                <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  NÂNG CẤP
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <p className="font-bold text-gray-900 text-sm mb-0.5">Phòng {sr.room_number}</p>
              <p className="text-xs text-gray-500 mb-2">{sr.type_name}</p>
              {sr.is_upsell && sr.price_diff > 0 && (
                <p className="text-xs text-amber-600 font-medium mb-2">
                  Chỉ thêm {formatVND(sr.price_diff)} để nâng cấp
                </p>
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
}

// ── Main Component ────────────────────────────────────────────────────────────
export function PhysicalRoomDetail() {
  const { room_id } = useParams<{ room_id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<PhysicalRoomData | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [similarRooms, setSimilarRooms] = useState<any[]>([]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  const datesSelected = !!(checkIn && checkOut);

  const fetchRoom = useCallback(async () => {
    if (!room_id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await publicRoomApi.getPhysicalDetail(room_id);
      setRoom(data);
      setPricingRules(data.pricing_rules ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Không thể tải thông tin phòng');
    } finally {
      setLoading(false);
    }
  }, [room_id, checkIn, checkOut]);

  const fetchSimilar = useCallback(async () => {
    if (!room_id) return;
    try {
      const data = await publicRoomApi.getSimilarRooms(room_id, { check_in: checkIn, check_out: checkOut });
      setSimilarRooms(data ?? []);
    } catch {
      setSimilarRooms([]);
    }
  }, [room_id, checkIn, checkOut]);

  const fetchReviews = useCallback(async () => {
    if (!room?.type_id) return;
    try {
      const data = await reviewApi.list(room.type_id);
      setReviews(data ?? []);
    } catch {
      setReviews([]);
    }
  }, [room?.type_id]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);
  useEffect(() => { fetchSimilar(); }, [fetchSimilar]);
  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const images = useMemo(() => {
    if (!room) return [FALLBACK];
    const imgs = [room.image, ...(room.extra_images ?? [])].filter(Boolean) as string[];
    return imgs.length ? imgs : [FALLBACK];
  }, [room]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const diff = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000;
    return diff > 0 ? diff : 0;
  }, [checkIn, checkOut]);

  const basePrice = room?.effective_price ?? room?.price_per_night ?? 0;

  const earlyCheckInFee  = useMemo(() => calcFeeFromRules(pricingRules, 'checkin',  checkInTime,  basePrice), [pricingRules, checkInTime,  basePrice]);
  const lateCheckOutFee  = useMemo(() => calcFeeFromRules(pricingRules, 'checkout', checkOutTime, basePrice), [pricingRules, checkOutTime, basePrice]);

  const subtotal    = basePrice * nights;
  const serviceFee  = Math.round(subtotal * SERVICE_FEE_RATE);
  const vat         = Math.round(subtotal * VAT_RATE);
  const total       = subtotal + serviceFee + vat + earlyCheckInFee + lateCheckOutFee;

  const canBook = datesSelected && room?.availability_status === 'AVAILABLE';

  const handleBook = () => {
    if (!user) { navigate('/login'); return; }
    if (!canBook || !room) return;
    navigate('/checkout', {
      state: {
        room_id: room.room_id,
        room_number: room.room_number,
        type_name: room.type_name,
        image: images[0],
        check_in: checkIn,
        check_out: checkOut,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        nights,
        base_price: basePrice,
        early_checkin_fee: earlyCheckInFee,
        late_checkout_fee: lateCheckOutFee,
        service_fee: serviceFee,
        vat,
        total,
      },
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
    </div>
  );

  if (error || !room) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <AlertTriangle className="h-12 w-12 text-red-400" />
      <p className="text-gray-600">{error ?? 'Không tìm thấy phòng'}</p>
      <Button onClick={() => navigate(-1)}>Quay lại</Button>
    </div>
  );

  const avg = avgRating(reviews);

  return (
    <div className="min-h-screen bg-gray-50">
      {lightboxOpen && (
        <Lightbox images={images} index={lightboxIdx} onClose={() => setLightboxOpen(false)} onChange={setLightboxIdx} />
      )}

      {/* Hero Gallery */}
      <div className="relative h-[55vh] bg-gray-900 overflow-hidden cursor-pointer group"
        onClick={() => setLightboxOpen(true)}>
        <img src={images[0]} alt={room.room_number} referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <button className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-white/30 transition">
          <Maximize2 className="h-4 w-4" /> Xem tất cả {images.length} ảnh
        </button>
        {images.length > 1 && (
          <div className="absolute bottom-4 left-4 flex gap-2">
            {images.slice(1, 5).map((img, i) => (
              <div key={i} className="w-16 h-12 rounded-lg overflow-hidden border-2 border-white/40 cursor-pointer hover:border-white transition"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(i + 1); setLightboxOpen(true); }}>
                <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="info">Tầng {room.floor}</Badge>
                  <Badge variant="default">Phòng {room.room_number}</Badge>
                  <AvailBadge status={room.availability_status} datesSelected={datesSelected} />
                </div>
                <h1 className="text-3xl font-black text-gray-900">{room.type_name}</h1>
                {avg > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <StarRow value={avg} />
                    <span className="text-sm text-gray-500">{avg.toFixed(1)} ({reviews.length} đánh giá)</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-blue-600">{formatVND(basePrice)}</p>
                <p className="text-sm text-gray-400">/ đêm</p>
              </div>
            </div>
          </div>

          {/* Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Tiện nghi phòng</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {room.amenities.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {a}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Description */}
          {room.description && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Mô tả</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{room.description}</p>
            </Card>
          )}

          {/* Policies */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" /> Chính sách
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Nhận phòng: từ 14:00</span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>Trả phòng: trước 12:00</span>
              </div>
              {pricingRules.map((r) => (
                <div key={r.rule_id} className="flex items-start gap-2 col-span-full">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span>{r.description} (+{r.percent}%)</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Reviews */}
          {reviews.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                Đánh giá ({reviews.length})
              </h2>
              <div className="space-y-4">
                {reviews.slice(0, 5).map((rv) => (
                  <div key={rv.review_id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-gray-800">{rv.full_name ?? 'Khách'}</span>
                      <StarRow value={rv.rating} />
                    </div>
                    {rv.comment && <p className="text-sm text-gray-600">{rv.comment}</p>}
                    {rv.reply && (
                      <div className="mt-2 pl-3 border-l-2 border-blue-200 text-xs text-gray-500 italic">
                        Phản hồi: {rv.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Similar Rooms */}
          {similarRooms.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Phòng tương tự</h2>
              <SimilarCarousel rooms={similarRooms} currentRoomId={room_id} />
            </div>
          )}
        </div>

        {/* Right Column — Booking Card */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <Card className="p-6 shadow-xl border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Đặt phòng</h2>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nhận phòng</label>
                  <input type="date" value={checkIn} min={TODAY}
                    onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(''); }}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trả phòng</label>
                  <input type="date" value={checkOut} min={checkIn || TODAY}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>

                {pricingRules.length > 0 && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Giờ nhận phòng {getFeeLabel(pricingRules, 'checkin', checkInTime) && <span className="text-amber-500">{getFeeLabel(pricingRules, 'checkin', checkInTime)}</span>}
                      </label>
                      <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)}
                        className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Giờ trả phòng {getFeeLabel(pricingRules, 'checkout', checkOutTime) && <span className="text-amber-500">{getFeeLabel(pricingRules, 'checkout', checkOutTime)}</span>}
                      </label>
                      <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)}
                        className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </>
                )}
              </div>

              {datesSelected && nights > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{formatVND(basePrice)} × {nights} đêm</span>
                    <span>{formatVND(subtotal)}</span>
                  </div>
                  {earlyCheckInFee > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Phí nhận phòng sớm</span>
                      <span>+{formatVND(earlyCheckInFee)}</span>
                    </div>
                  )}
                  {lateCheckOutFee > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Phí trả phòng muộn</span>
                      <span>+{formatVND(lateCheckOutFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Phí dịch vụ ({(SERVICE_FEE_RATE * 100).toFixed(0)}%)</span>
                    <span>{formatVND(serviceFee)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                    <span>{formatVND(vat)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Tổng cộng</span>
                    <span className="text-blue-600">{formatVND(total)}</span>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!canBook}
                onClick={handleBook}
              >
                {!datesSelected ? 'Chọn ngày để đặt phòng' :
                  room.availability_status !== 'AVAILABLE' ? 'Phòng không khả dụng' :
                  nights === 0 ? 'Ngày không hợp lệ' : 'Đặt phòng ngay'}
              </Button>

              {!user && datesSelected && (
                <p className="text-xs text-center text-gray-400 mt-2">
                  Bạn cần <Link to="/login" className="text-blue-500 hover:underline">đăng nhập</Link> để đặt phòng
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
