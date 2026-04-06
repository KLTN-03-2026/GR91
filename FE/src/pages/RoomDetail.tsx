import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star, Users, Maximize, BedDouble, Check, Calendar,
  ChevronLeft, ChevronRight, Loader2, X, MapPin, Shield, MessageSquare, Maximize2,
} from 'lucide-react';
import { formatVND } from '../lib/utils';
import { SERVICE_FEE_RATE, VAT_RATE } from '../lib/constants';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { roomApi, reviewApi, type ApiRoom, type ApiReview } from '../lib/api';
import { useAuth } from '../lib/auth';

const FALLBACK = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';
const TODAY = new Date().toISOString().split('T')[0];

// ── helpers ──────────────────────────────────────────────────────────────────
function buildRoom(api: ApiRoom) {
  const imgs = api.rooms?.flatMap((r) => {
    if (Array.isArray(r.images)) return r.images;
    if (typeof r.images === 'string') return (r.images as string).split('|||');
    return [];
  }).filter(Boolean) ?? [];
  if (!imgs.length && api.image) imgs.push(api.image);
  if (!imgs.length) imgs.push(FALLBACK);

  const amenities = Array.isArray(api.amenities)
    ? api.amenities.map((a: any) => (typeof a === 'string' ? a : a.name)).filter(Boolean)
    : [];

  const beds: { name: string; quantity: number }[] = Array.isArray(api.beds) ? api.beds : [];

  return {
    id: String(api.type_id),
    name: api.type_name,
    type: api.type_name,
    price: api.base_price,
    capacity: api.capacity,
    area_sqm: (api as any).area_sqm ?? null,
    category_name: (api as any).category_name ?? null,
    description: api.description ?? '',
    roomNotes: [...new Set(
      (api.rooms ?? [])
        .map((r: any) => r.room_note)
        .filter((n: any) => n && n.trim())
    )] as string[],
    amenities,
    beds,
    images: imgs,
    availableRooms: api.rooms ?? [],
  };
}

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

// ── Lightbox ─────────────────────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={onClose}>
        <X className="h-7 w-7" />
      </button>
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full text-white"
        onClick={(e) => { e.stopPropagation(); onChange((index - 1 + images.length) % images.length); }}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <img
        src={images[index]} alt="" onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        referrerPolicy="no-referrer"
      />
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

// ── Main component ────────────────────────────────────────────────────────────
export const RoomDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom]       = useState<ReturnType<typeof buildRoom> | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [imgIndex, setImgIndex]       = useState(0);
  const [lightbox, setLightbox]       = useState(false);
  const [activeTab, setActiveTab]     = useState<'info' | 'reviews'>('info');

  const [checkIn,  setCheckIn]  = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(2);

  useEffect(() => {
    if (!id) return;
    // Fetch room và reviews độc lập — reviews lỗi không ảnh hưởng room
    roomApi.detail(id)
      .then((r) => setRoom(buildRoom(r)))
      .catch(() => setError('Không thể tải thông tin phòng. Vui lòng kiểm tra kết nối và thử lại.'))
      .finally(() => setLoading(false));

    reviewApi.list(id)
      .then(setReviews)
      .catch(() => {}); // reviews lỗi thì bỏ qua
  }, [id]);

  const nights = useCallback(() => {
    if (!checkIn || !checkOut) return 1;
    const d = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000;
    return d > 0 ? d : 1;
  }, [checkIn, checkOut]);

  const n         = nights();
  const basePrice = (room?.price ?? 0) * n;
  const svcFee    = basePrice * SERVICE_FEE_RATE;
  const vat       = basePrice * VAT_RATE;
  const total     = basePrice + svcFee + vat;
  const rating    = avgRating(reviews);

  const handleBook = () => {
    if (!user) { navigate('/login'); return; }
    if (!checkIn || !checkOut) { alert('Vui lòng chọn ngày nhận và trả phòng'); return; }
    navigate('/checkout', { state: { room, checkIn, checkOut, guestCount, nights: n } });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (error || !room) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-10 text-center max-w-md w-full">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Không tải được thông tin phòng</h2>
        <p className="text-sm text-gray-500 mb-6">{error || 'Phòng không tồn tại hoặc đã bị xóa.'}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Thử lại
          </button>
          <Link to="/rooms" className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Xem danh sách phòng
          </Link>
        </div>
      </div>
    </div>
  );

  const images = room.images;

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {lightbox && (
        <Lightbox images={images} index={imgIndex} onClose={() => setLightbox(false)} onChange={setImgIndex} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:text-blue-600">Trang chủ</Link>
          <span>/</span>
          <Link to="/rooms" className="hover:text-blue-600">Phòng</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{room.name}</span>
        </nav>

        {/* Title row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="blue">{room.type}</Badge>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <StarRow value={rating} />
                  <span className="font-semibold text-gray-800">{rating.toFixed(1)}</span>
                  <span className="text-gray-400">({reviews.length} đánh giá)</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{room.name}</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> SmartHotel — Hà Nội, Việt Nam
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-500 mb-0.5">Giá mỗi đêm từ</p>
            <p className="text-3xl font-bold text-blue-600">{formatVND(room.price)}</p>
          </div>
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] mb-10 rounded-2xl overflow-hidden">
          {/* Main image */}
          <div
            className="col-span-4 md:col-span-2 row-span-2 relative cursor-pointer group"
            onClick={() => { setImgIndex(0); setLightbox(true); }}
          >
            <img src={images[0]} alt={room.name} className="w-full h-full object-cover group-hover:brightness-90 transition" referrerPolicy="no-referrer" />
            <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
              {images.length} ảnh
            </div>
          </div>

          {/* Side images — hiện tối đa 4, ảnh cuối overlay "+X ảnh" nếu còn thêm */}
          {[1, 2, 3, 4].map((slot) => {
            const hasImg = slot < images.length;
            const isLast = slot === 4;
            const remaining = images.length - 5; // ảnh chưa hiện (ngoài 5 cái đầu)
            return (
              <div
                key={slot}
                className="hidden md:block relative cursor-pointer group overflow-hidden bg-gray-100"
                onClick={() => { setImgIndex(hasImg ? slot : 0); setLightbox(true); }}
              >
                {hasImg ? (
                  <img
                    src={images[slot]}
                    alt={`${room.name} ${slot + 1}`}
                    className="w-full h-full object-cover group-hover:brightness-90 transition"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                    Chưa có ảnh
                  </div>
                )}
                {/* Overlay "+X ảnh" ở slot cuối nếu còn ảnh chưa hiện */}
                {isLast && remaining > 0 && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white">
                    <span className="text-2xl font-bold">+{remaining}</span>
                    <span className="text-xs mt-0.5">ảnh</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left — info + reviews */}
          <div className="flex-1 min-w-0">
            {/* Quick stats */}
            <div className="flex flex-wrap gap-6 mb-8 pb-8 border-b border-gray-200">
              <Stat icon={<Users className="h-5 w-5" />} label="Sức chứa" value={`${room.capacity} khách`} />
              {room.area_sqm && (
                <Stat icon={<Maximize2 className="h-5 w-5" />} label="Diện tích" value={`${room.area_sqm} m²`} />
              )}
              {room.beds.length > 0 && (
                <Stat icon={<BedDouble className="h-5 w-5" />} label="Giường" value={room.beds.map((b) => `${b.quantity} ${b.name}`).join(', ')} />
              )}
              {room.category_name && (
                <Stat icon={<Shield className="h-5 w-5" />} label="Hạng phòng" value={room.category_name} />
              )}
              <Stat icon={<MessageSquare className="h-5 w-5" />} label="Đánh giá" value={reviews.length ? `${rating.toFixed(1)}/5` : 'Chưa có'} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
              {(['info', 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'info' ? 'Thông tin' : `Đánh giá (${reviews.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'info' && (
              <div className="space-y-8">
                {/* Mô tả loại phòng */}
                {room.description && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Mô tả phòng</h2>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-line">{room.description}</p>
                  </div>
                )}

                {/* Mô tả chi tiết từng phòng (room_note) */}
                {room.roomNotes.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Chi tiết phòng</h2>
                    <div className="space-y-2">
                      {room.roomNotes.map((note, i) => (
                        <p key={i} className="text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 rounded-xl px-4 py-3 text-sm">
                          {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {room.amenities.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Tiện nghi phòng</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {room.amenities.map((a) => (
                        <div key={a} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span className="text-sm text-gray-700">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                {reviews.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Star className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p>Chưa có đánh giá nào cho loại phòng này.</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="flex items-center gap-6 bg-blue-50 rounded-2xl p-5 mb-6">
                      <div className="text-center">
                        <p className="text-5xl font-bold text-blue-600">{rating.toFixed(1)}</p>
                        <StarRow value={rating} />
                        <p className="text-xs text-gray-500 mt-1">{reviews.length} đánh giá</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {[5,4,3,2,1].map((star) => {
                          const count = reviews.filter((r) => r.rating === star).length;
                          const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                          return (
                            <div key={star} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-3">{star}</span>
                              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-yellow-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-5 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Review list */}
                    <div className="space-y-4">
                      {reviews.map((rv) => (
                        <div key={rv.review_id} className="bg-white border border-gray-100 rounded-2xl p-5">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">
                                {rv.full_name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 text-sm">{rv.full_name || rv.username}</p>
                                <p className="text-xs text-gray-400">{new Date(rv.created_at).toLocaleDateString('vi-VN')}</p>
                              </div>
                            </div>
                            <StarRow value={rv.rating} />
                          </div>
                          {rv.comment && <p className="text-sm text-gray-600 leading-relaxed">{rv.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right — booking widget */}
          <div className="w-full lg:w-80 shrink-0">
            <Card className="sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-5">Đặt phòng ngay</h3>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Ngày nhận phòng</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date" value={checkIn} min={TODAY}
                      onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(''); }}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Ngày trả phòng</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date" value={checkOut} min={checkIn || TODAY}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Số khách</label>
                  <select
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: room.capacity }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} khách</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price breakdown */}
              <div className="border-t border-gray-100 pt-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{formatVND(room.price)} × {n} đêm</span>
                  <span>{formatVND(basePrice)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Phí dịch vụ (5%)</span>
                  <span>{formatVND(svcFee)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Thuế VAT (10%)</span>
                  <span>{formatVND(vat)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-100 text-base">
                  <span>Tổng cộng</span>
                  <span className="text-blue-600">{formatVND(total)}</span>
                </div>
              </div>

              <Button fullWidth size="lg" onClick={handleBook}>
                {user ? 'Tiến hành đặt phòng' : 'Đăng nhập để đặt phòng'}
              </Button>
              <p className="text-center text-xs text-gray-400 mt-3">Bạn chưa bị trừ tiền lúc này</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Stat chip ─────────────────────────────────────────────────────────────────
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-gray-900 text-sm">{value}</p>
      </div>
    </div>
  );
}
