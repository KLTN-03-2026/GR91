import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Star, Search, Eye, EyeOff, Trash2,
  Loader2, RefreshCw, Filter, BarChart3, BedDouble,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { reviewApi, type AdminReview, type ReviewStats } from '../../lib/api';
import { formatDate } from '../../lib/utils';

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=200&q=60';

// ── Star display ──────────────────────────────────────────────────────────────
function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`${color} rounded-2xl p-4`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats,   setStats]   = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');
  const [filterRating, setFilterRating] = useState<number>(0);
  const [filterRoom,   setFilterRoom]   = useState<string>('');   // room_number

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        reviewApi.adminList(),
        reviewApi.adminStats(),
      ]);
      setReviews(data);
      setStats(s);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Danh sách phòng duy nhất để làm dropdown filter
  const roomOptions = useMemo(() => {
    const map = new Map<string, { room_number: string; room_type: string }>();
    reviews.forEach((r) => {
      if (r.room_number) map.set(r.room_number, { room_number: r.room_number, room_type: r.room_type });
    });
    return Array.from(map.values()).sort((a, b) => a.room_number.localeCompare(b.room_number));
  }, [reviews]);

  const handleVisibility = async (id: number, status: 'VISIBLE' | 'HIDDEN') => {
    try {
      await reviewApi.setVisibility(id, status);
      setReviews((prev) => prev.map((r) => r.review_id === id ? { ...r, status } : r));
      setStats((s) => s ? {
        ...s,
        visible: s.visible + (status === 'VISIBLE' ? 1 : -1),
        hidden:  s.hidden  + (status === 'HIDDEN'  ? 1 : -1),
      } : s);
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xoá vĩnh viễn đánh giá này?')) return;
    try {
      await reviewApi.remove(id);
      setReviews((prev) => prev.filter((r) => r.review_id !== id));
      setStats((s) => s ? { ...s, total: s.total - 1 } : s);
    } catch (e: any) { alert(e.message); }
  };

  const filtered = reviews.filter((r) => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterRating > 0 && r.rating !== filterRating) return false;
    if (filterRoom && r.room_number !== filterRoom) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.full_name?.toLowerCase().includes(q) ||
        r.comment?.toLowerCase().includes(q) ||
        r.room_type?.toLowerCase().includes(q) ||
        r.room_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý đánh giá</h1>
          <p className="text-sm text-gray-500 mt-0.5">Theo dõi và kiểm soát đánh giá từ khách hàng</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-4 w-4" /> Làm mới
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Tổng đánh giá"   value={stats.total}                   color="bg-blue-50"   />
          <StatCard label="Đang hiển thị"   value={stats.visible}                 color="bg-green-50"  />
          <StatCard label="Đã ẩn"           value={stats.hidden}                  color="bg-red-50"    />
          <StatCard label="Điểm trung bình" value={`${stats.avg_rating ?? 0} ★`} color="bg-yellow-50" />
        </div>
      )}

      {/* Rating distribution */}
      {stats && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Phân bố đánh giá</p>
          </div>
          <div className="space-y-2">
            {[
              { label: '5 sao',   count: stats.five_star,  color: 'bg-green-400'  },
              { label: '4 sao',   count: stats.four_star,  color: 'bg-lime-400'   },
              { label: '3 sao',   count: stats.three_star, color: 'bg-yellow-400' },
              { label: '1-2 sao', count: stats.low_star,   color: 'bg-red-400'    },
            ].map(({ label, count, color }) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="w-14 text-gray-500 shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-gray-600 font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Table */}
      <Card padding={false}>
        {/* Filters */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          {/* Status tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(['ALL', 'VISIBLE', 'HIDDEN'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {s === 'ALL' ? 'Tất cả' : s === 'VISIBLE' ? '👁 Hiển thị' : '🚫 Đã ẩn'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter theo sao */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select value={filterRating} onChange={(e) => setFilterRating(Number(e.target.value))}
                className="text-xs text-gray-600 bg-transparent outline-none">
                <option value={0}>Tất cả sao</option>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} sao</option>)}
              </select>
            </div>

            {/* Filter theo phòng */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5">
              <BedDouble className="h-3.5 w-3.5 text-gray-400" />
              <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}
                className="text-xs text-gray-600 bg-transparent outline-none max-w-[140px]">
                <option value="">Tất cả phòng</option>
                {roomOptions.map((r) => (
                  <option key={r.room_number} value={r.room_number}>
                    Phòng {r.room_number} — {r.room_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input type="text" placeholder="Tìm tên, nội dung, phòng..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-48" />
            </div>

            {/* Clear filters */}
            {(filterStatus !== 'ALL' || filterRating > 0 || filterRoom || search) && (
              <button
                onClick={() => { setFilterStatus('ALL'); setFilterRating(0); setFilterRoom(''); setSearch(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Xoá lọc
              </button>
            )}
          </div>
        </div>

        {/* Count */}
        <div className="px-5 py-2 border-b border-gray-100 text-xs text-gray-400">
          Hiển thị <span className="font-semibold text-gray-700">{filtered.length}</span> / {reviews.length} đánh giá
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Không có đánh giá nào</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((rv) => (
              <div key={rv.review_id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">

                  {/* Room image */}
                  <img
                    src={rv.room_image ?? FALLBACK_IMG}
                    alt={rv.room_number ?? ''}
                    className="w-16 h-16 object-cover rounded-xl shrink-0 border border-gray-100"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: user + rating + status + date */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {rv.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{rv.full_name}</span>
                      {rv.email && <span className="text-xs text-gray-400">{rv.email}</span>}
                      <Stars value={rv.rating} />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        rv.status === 'VISIBLE'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        {rv.status === 'VISIBLE' ? 'Hiển thị' : 'Đã ẩn'}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{formatDate(rv.created_at)}</span>
                    </div>

                    {/* Row 2: room info */}
                    <div className="flex items-center gap-2 mb-2">
                      <BedDouble className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-xs font-medium text-gray-700">{rv.room_type}</span>
                      {rv.room_number && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-blue-600 font-medium">Phòng {rv.room_number}</span>
                        </>
                      )}
                      {rv.floor != null && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-400">Tầng {rv.floor}</span>
                        </>
                      )}
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">Booking #{rv.booking_id}</span>
                    </div>

                    {/* Row 3: comment */}
                    {rv.comment && (
                      <p className="text-sm text-gray-700 leading-relaxed">{rv.comment}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {rv.status === 'VISIBLE' ? (
                      <button onClick={() => handleVisibility(rv.review_id, 'HIDDEN')} title="Ẩn"
                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                        <EyeOff className="h-4 w-4" />
                      </button>
                    ) : (
                      <button onClick={() => handleVisibility(rv.review_id, 'VISIBLE')} title="Hiện lại"
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(rv.review_id)} title="Xoá"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};
