import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, Loader2, Save, Plus, Trash2, X,
  Image as ImageIcon, BedDouble, CalendarCheck, User,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { adminRoomApi, type RoomUnit } from '../../lib/api';

const STATUS_OPTIONS = [
  { value: 'ACTIVE',      label: 'Hoạt động',       cls: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'INACTIVE',    label: 'Ngừng hoạt động', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { value: 'MAINTENANCE', label: 'Đang bảo trì',    cls: 'text-red-700 bg-red-50 border-red-200' },
];

const BOOKING_STATUS: Record<string, { label: string; variant: 'green' | 'yellow' | 'blue' | 'red' | 'gray' }> = {
  CONFIRMED: { label: 'Đã xác nhận', variant: 'green' },
  PENDING:   { label: 'Chờ xử lý',   variant: 'yellow' },
  COMPLETED: { label: 'Hoàn thành',  variant: 'blue' },
  CANCELLED: { label: 'Đã hủy',      variant: 'red' },
};

interface RoomImage { image_id: number; url: string; }
interface Booking {
  booking_id: number; status: string; created_at: string;
  check_in: string; check_out: string;
  full_name: string; email: string; phone: string;
}

type Tab = 'info' | 'images' | 'bookings';

export const AdminRoomUnit: React.FC = () => {
  const { typeId, roomId } = useParams<{ typeId: string; roomId: string }>();

  const [unit, setUnit]       = useState<RoomUnit | null>(null);
  const [images, setImages]   = useState<RoomImage[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('info');

  const [form, setForm]     = useState({ room_number: '', floor: '1', status: 'ACTIVE', room_note: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [imgUrl, setImgUrl]       = useState('');
  const [imgSaving, setImgSaving] = useState(false);
  const [imgError, setImgError]   = useState('');
  const [preview, setPreview]     = useState('');

  useEffect(() => {
    if (!roomId || !typeId) return;
    Promise.all([
      adminRoomApi.listUnits(typeId).then((units) => units.find((u) => u.room_id === Number(roomId))),
      adminRoomApi.listImages(Number(roomId)),
      adminRoomApi.listBookings(Number(roomId)),
    ]).then(([u, imgs, bks]) => {
      if (u) {
        setUnit(u);
        setForm({ room_number: u.room_number, floor: String(u.floor), status: u.status, room_note: u.room_note ?? '' });
      }
      setImages(imgs);
      setBookings(bks);
    }).finally(() => setLoading(false));
  }, [roomId, typeId]);

  const handleSave = async () => {
    if (!unit) return;
    setSaving(true);
    try {
      await adminRoomApi.updateUnit(unit.room_id, {
        room_number: form.room_number,
        floor: Number(form.floor),
        status: form.status,
        room_note: form.room_note || undefined,
      });
      setUnit((u) => u ? {
        ...u,
        room_number: form.room_number,
        floor: Number(form.floor),
        status: form.status as any,
        room_note: form.room_note || null,
      } : u);
      showToast('Lưu thông tin phòng thành công!');
    } catch (e: any) {
      showToast(e.message ?? 'Lưu thất bại', 'error');
    } finally { setSaving(false); }
  };

  const handleAddImage = async () => {
    const url = imgUrl.trim();
    if (!url) return;
    setImgError(''); setImgSaving(true);
    try {
      const img = await adminRoomApi.addImage(Number(roomId), url);
      setImages((p) => [...p, img]);
      setImgUrl(''); setPreview('');
    } catch (e: any) {
      setImgError(e.message ?? 'Không thể thêm ảnh');
    } finally { setImgSaving(false); }
  };

  const handleDeleteImage = async (imageId: number) => {
    await adminRoomApi.deleteImage(imageId);
    setImages((p) => p.filter((i) => i.image_id !== imageId));
  };

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
  );
  if (!unit) return (
    <div className="text-center py-20 text-gray-400">Không tìm thấy phòng</div>
  );

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === (form.status || unit.status)) ?? STATUS_OPTIONS[0];

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success'
            ? <Save className="h-4 w-4 shrink-0" />
            : <X className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <Link to="/admin/rooms" className="hover:text-blue-600">Loại phòng</Link>
        <span>/</span>
        <Link to={`/admin/rooms/${typeId}`} className="hover:text-blue-600">Chi tiết loại</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Phòng {unit.room_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <BedDouble className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Phòng {unit.room_number}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              Tầng {unit.floor}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </p>
            {unit.room_note && (
              <p className="text-sm text-gray-500 mt-1 max-w-xl">{unit.room_note}</p>
            )}
          </div>
        </div>
        <Link to={`/admin/rooms/${typeId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> Quay lại
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'info',     label: 'Thông tin',  icon: BedDouble },
          { key: 'images',   label: `Ảnh (${images.length})`, icon: ImageIcon },
          { key: 'bookings', label: `Lịch sử đặt (${bookings.length})`, icon: CalendarCheck },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === 'info' && (
        <div className="max-w-lg">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-5">Thông tin phòng</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Số phòng</label>
                <input
                  value={form.room_number}
                  onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Tầng</label>
                <input
                  type="number" min={1} value={form.floor}
                  onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Trạng thái</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Mô tả phòng</label>
                <textarea
                  value={form.room_note}
                  onChange={(e) => setForm((f) => ({ ...f, room_note: e.target.value }))}
                  rows={4}
                  placeholder="Nhập mô tả chi tiết về phòng này..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <Button fullWidth onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Images */}
      {tab === 'images' && (
        <Card>
          <div className="mb-5 space-y-2">
            <label className="block text-xs font-medium text-gray-700">Thêm ảnh qua URL</label>
            <div className="flex gap-2">
              <input
                value={imgUrl}
                onChange={(e) => { setImgUrl(e.target.value); setPreview(e.target.value.trim()); setImgError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                placeholder="https://example.com/image.jpg"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddImage}
                disabled={imgSaving || !imgUrl.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-sm font-medium"
              >
                {imgSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Thêm
              </button>
            </div>
            {imgError && <p className="text-xs text-red-600">{imgError}</p>}
            {preview && (
              <div className="relative mt-2 rounded-xl overflow-hidden border border-gray-200 h-36 max-w-xs">
                <img src={preview} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer"
                  onError={() => setImgError('URL ảnh không hợp lệ')} />
                <button onClick={() => { setPreview(''); setImgUrl(''); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">Preview</span>
              </div>
            )}
          </div>

          {images.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl py-14 text-center text-gray-400">
              <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Chưa có ảnh nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div key={img.image_id} className="relative group rounded-xl overflow-hidden border border-gray-100 aspect-video">
                  <img src={img.url} alt={`Ảnh ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:brightness-75 transition"
                    referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => handleDeleteImage(img.image_id)}
                      className="bg-red-600 text-white rounded-full p-2 hover:bg-red-700 shadow-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
                    #{idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Bookings */}
      {tab === 'bookings' && (
        <Card padding={false}>
          {bookings.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Chưa có lịch sử đặt phòng nào.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  {['Mã đặt phòng', 'Khách hàng', 'Nhận phòng', 'Trả phòng', 'Trạng thái'].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((b) => {
                  const st = BOOKING_STATUS[b.status.toUpperCase()] ?? { label: b.status, variant: 'gray' as const };
                  return (
                    <tr key={b.booking_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-700">#{b.booking_id}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {b.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{b.full_name}</p>
                            <p className="text-xs text-gray-400">{b.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {new Date(b.check_in).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {new Date(b.check_out).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
};
