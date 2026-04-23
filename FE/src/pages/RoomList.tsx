import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Filter, SlidersHorizontal, Loader2, BedDouble, Building2,
  Users, ChevronLeft, ChevronRight, Maximize2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SORT_OPTIONS } from '../lib/constants';
import { formatVND } from '../lib/utils';
import { roomApi, type ApiRoomUnit } from '../lib/api';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
const PAGE_SIZE = 6;

export const RoomList: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [checkIn,  setCheckIn]  = useState(searchParams.get('check_in')  ?? '');
  const [checkOut, setCheckOut] = useState(searchParams.get('check_out') ?? '');
  const [capacity, setCapacity] = useState(Number(searchParams.get('capacity') ?? 0));
  const [maxPrice, setMaxPrice] = useState(10_000_000);
  const [minPrice, setMinPrice] = useState(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);
  const [sortBy, setSortBy]     = useState(searchParams.get('sort') || 'price_asc');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage]         = useState(1);

  const [units, setUnits]     = useState<ApiRoomUnit[]>([]);
  const [recommendedTypes, setRecommendedTypes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchUnits = useCallback(() => {
    setLoading(true);
    setError('');
    roomApi.listUnits({
      check_in:  checkIn  || undefined,
      check_out: checkOut || undefined,
      capacity:  capacity || undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice,
    })
      .then(setUnits)
      .catch(() => setError('Không thể tải danh sách phòng. Vui lòng thử lại.'))
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, capacity, minPrice, maxPrice]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  useEffect(() => {
    roomApi.recommendations(20).then(data => setRecommendedTypes(data.map((r: any) => r.type_id))).catch(() => {});
  }, []);

  // Lấy danh sách loại phòng động từ data
  const availableTypes = [...new Set(units.map((u) => u.type_name))].sort();

  const reset = () => {
    setCheckIn(''); setCheckOut(''); setCapacity(0);
    setMinPrice(0); setMaxPrice(10_000_000); setSelectedTypes([]); setSelectedFloors([]);
    setPage(1);
  };

  const filtered = units
    .filter((u) => selectedTypes.length === 0 || selectedTypes.includes(u.type_name))
    .filter((u) => selectedFloors.length === 0 || selectedFloors.includes(u.floor))
    .sort((a, b) => {
      if (sortBy === 'recommend' && recommendedTypes.length > 0) {
        const indexA = recommendedTypes.indexOf(a.type_id);
        const indexB = recommendedTypes.indexOf(b.type_id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }
      const pa = a.effective_price ?? a.base_price;
      const pb = b.effective_price ?? b.base_price;
      if (sortBy === 'price_asc')  return pa - pb;
      if (sortBy === 'price_desc') return pb - pa;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const FilterPanel = () => {
    const availableFloors = [...new Set<number>(units.map((u) => u.floor))].sort((a, b) => a - b);
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-100">
          <Filter className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Bộ lọc</h2>
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Ngày lưu trú</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nhận phòng</label>
                <input type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Trả phòng</label>
                <input type="date" value={checkOut} min={checkIn} onChange={(e) => { setCheckOut(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Số khách</h3>
            <select value={capacity} onChange={(e) => { setCapacity(Number(e.target.value)); setPage(1); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={0}>Tất cả</option>
              {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} khách trở lên</option>)}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium text-gray-900">Giá tối đa</h3>
              <span className="text-xs text-blue-600 font-medium">{formatVND(maxPrice)}</span>
            </div>
            <input type="range" min={500_000} max={10_000_000} step={500_000} value={maxPrice}
              onChange={(e) => { setMaxPrice(Number(e.target.value)); setPage(1); }}
              className="w-full accent-blue-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>500K</span><span>10M+</span>
            </div>
          </div>

          {availableTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Loại phòng</h3>
              <div className="space-y-2">
                {availableTypes.map((type) => (
                  <label key={type} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={selectedTypes.includes(type)}
                      onChange={() => {
                        setSelectedTypes((prev) =>
                          prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
                        );
                        setPage(1);
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {availableFloors.length > 1 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Tầng</h3>
              <div className="flex flex-wrap gap-2">
                {availableFloors.map((f) => (
                  <button key={f}
                    onClick={() => {
                      setSelectedFloors((prev) =>
                        prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                      );
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      selectedFloors.includes(f)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Tầng {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button fullWidth className="mt-6" onClick={reset} variant="secondary">Xóa bộ lọc</Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Danh sách phòng</h1>
          <p className="text-gray-500 text-sm">Tìm kiếm không gian nghỉ dưỡng hoàn hảo cho bạn.</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-72 shrink-0"><FilterPanel /></aside>

          <main className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-5">
              <span className="text-sm text-gray-600">
                Hiển thị <span className="font-semibold text-gray-900">{filtered.length}</span> phòng
              </span>
              <div className="flex items-center gap-2">
                <button className="lg:hidden flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50"
                  onClick={() => setFilterOpen((v) => !v)}>
                  <SlidersHorizontal className="h-4 w-4" /> Lọc
                </button>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border border-gray-200 text-gray-700 py-2 px-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {filterOpen && <div className="lg:hidden mb-6"><FilterPanel /></div>}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
                {error}
                <button onClick={fetchUnits} className="text-red-600 underline text-xs ml-4">Thử lại</button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center py-20 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin mr-3" />
                <span>Đang tải danh sách phòng...</span>
              </div>
            ) : paginated.length > 0 ? (
              <>
                <div className="space-y-5">
                  {paginated.map((unit) => <UnitCard key={unit.room_id} unit={unit} />)}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-9 h-9 text-sm rounded-lg font-medium transition-colors ${
                          p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-medium mb-2">Không tìm thấy phòng phù hợp</p>
                <p className="text-sm">Thử điều chỉnh bộ lọc để xem thêm kết quả.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

// ── Unit Card ─────────────────────────────────────────────────────────────────
function UnitCard({ unit }: { unit: ApiRoomUnit }) {
  const img = unit.image ?? FALLBACK_IMG;
  const price = unit.effective_price ?? unit.base_price;
  const hasDiscount = unit.effective_price != null && unit.effective_price !== unit.base_price;

  // Hiển thị giường từ beds[] nếu có
  const bedLabel = unit.beds?.length
    ? unit.beds.map((b) => `${b.quantity} ${b.name}`).join(', ')
    : null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col md:flex-row hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="md:w-2/5 h-56 md:h-auto relative shrink-0">
        <img src={img} alt={`Phòng ${unit.room_number}`}
          className="w-full h-full object-cover" referrerPolicy="no-referrer"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG; }} />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-gray-800">
            Tầng {unit.floor}
          </span>
          {unit.category_name && (
            <span className="bg-blue-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold text-white">
              {unit.category_name}
            </span>
          )}
        </div>
        {hasDiscount && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            Giá đặc biệt
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 md:p-6 flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Phòng {unit.room_number}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{unit.type_name}</p>
            </div>
          </div>

          {unit.room_note && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{unit.room_note}</p>
          )}

          <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-4">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-gray-400" /> {unit.capacity} khách
            </span>
            {unit.area_sqm && (
              <span className="flex items-center gap-1.5">
                <Maximize2 className="h-4 w-4 text-gray-400" /> {unit.area_sqm} m²
              </span>
            )}
            {bedLabel ? (
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-gray-400" /> {bedLabel}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-gray-400" /> Tầng {unit.floor}
              </span>
            )}
          </div>

          {unit.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {unit.amenities.slice(0, 5).map((a) => (
                <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">{a}</span>
              ))}
              {unit.amenities.length > 5 && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-md">+{unit.amenities.length - 5}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-end pt-4 border-t border-gray-100 mt-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Giá mỗi đêm</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600">{formatVND(price)}</span>
              {hasDiscount && (
                <span className="text-sm text-gray-400 line-through">{formatVND(unit.base_price)}</span>
              )}
            </div>
          </div>
          <Link to={`/room/${unit.room_id}`}
            className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Xem chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
}
