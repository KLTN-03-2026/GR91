import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, Loader2, Save, Plus, Trash2, X,
  Image as ImageIcon, BedDouble, CalendarCheck, Settings2,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { adminRoomApi, roomApi, type ApiRoom, type BedType, type RoomCategory } from '../../lib/api';
import { formatVND } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';

const STATUS_OPTIONS = [
  { value: 'ACTIVE',      label: 'Hoạt động',       cls: 'text-green-700 bg-green-50 border-green-200',    dot: 'bg-green-400'  },
  { value: 'INACTIVE',    label: 'Ngừng hoạt động', cls: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
  { value: 'CLEANING',    label: 'Đang dọn phòng',  cls: 'text-orange-700 bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
  { value: 'MAINTENANCE', label: 'Bảo trì',          cls: 'text-gray-600 bg-gray-100 border-gray-200',     dot: 'bg-gray-400'   },
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
interface RoomDetail {
  room_id: number; room_number: string; floor: number; status: string; room_note: string | null;
  type_id: number; type_name: string; base_price: number; capacity: number;
  area_sqm: number | null; category_name: string | null;
  override_price: number | null; effective_price: number;
  beds: { name: string; quantity: number }[];
}

type Tab = 'info' | 'images' | 'bookings';

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

export const AdminRoomUnit: React.FC = () => {
  const { typeId, roomId } = useParams<{ typeId: string; roomId: string }>();
  const toast = useToast();

  const [detail, setDetail]     = useState<RoomDetail | null>(null);
  const [images, setImages]     = useState<RoomImage[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('info');

  const [form, setForm]     = useState({ room_number: '', floor: '1', status: 'ACTIVE', room_note: '' });
  const [saving, setSaving] = useState(false);

  const [roomTypes, setRoomTypes]               = useState<ApiRoom[]>([]);
  const [bedTypes, setBedTypes]                 = useState<BedType[]>([]);
  const [selectedTypeId, setSelectedTypeId]     = useState('');
  const [typeChanging, setTypeChanging]         = useState(false);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickForm, setQuickForm] = useState({
    name: '', base_price: '', capacity: '2',
    category_id: '', area_sqm: '', bed_id: '', bed_quantity: '1',
  });
  const [quickAutoName, setQuickAutoName] = useState(true);
  const [categories, setCategories]       = useState<RoomCategory[]>([]);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError]   = useState('');

  const [imgUrl, setImgUrl]       = useState('');
  const [imgSaving, setImgSaving] = useState(false);
  const [imgError, setImgError]   = useState('');
  const [preview, setPreview]     = useState('');

  const loadDetail = async () => {
    if (!roomId) return;
    const [det, imgs, bks] = await Promise.all([
      adminRoomApi.getDetail(Number(roomId)),
      adminRoomApi.listImages(Number(roomId)),
      adminRoomApi.listBookings(Number(roomId)),
    ]);
    setDetail(det);
    setSelectedTypeId(String(det.type_id));
    setForm({ room_number: det.room_number, floor: String(det.floor), status: det.status, room_note: det.room_note ?? '' });
    setImages(imgs);
    setBookings(bks);
  };

  useEffect(() => {
    if (!roomId) return;
    Promise.all([
      loadDetail(),
      roomApi.list().then(setRoomTypes),
      roomApi.listBedTypes().then(setBedTypes),
      roomApi.listCategories().then(setCategories),
    ]).finally(() => setLoading(false));
  }, [roomId]);

  const previewType = roomTypes.find((t) => String(t.type_id) === selectedTypeId);

  // Auto-generate tên từ hạng + loại giường
  useEffect(() => {
    if (!quickAutoName) return;
    const catName = categories.find((c) => String(c.category_id) === quickForm.category_id)?.name ?? '';
    const bedName = bedTypes.find((b) => String(b.bed_id) === quickForm.bed_id)?.name ?? '';
    const parts = [catName, bedName].filter(Boolean);
    if (parts.length) setQuickForm((f) => ({ ...f, name: parts.join(' - ') }));
  }, [quickForm.category_id, quickForm.bed_id, quickAutoName, categories, bedTypes]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await adminRoomApi.updateUnit(detail.room_id, {
        room_number: form.room_number,
        floor: Number(form.floor),
        status: form.status,
        room_note: form.room_note || undefined,
      });
      setDetail((d) => d ? { ...d, room_number: form.room_number, floor: Number(form.floor), status: form.status, room_note: form.room_note || null } : d);
      toast('Lưu thông tin phòng thành công');
    } catch (e: any) {
      toast(e.message ?? 'Lưu thất bại', 'error');
    } finally { setSaving(false); }
  };

  const handleChangeType = async () => {
    if (!detail || selectedTypeId === String(detail.type_id)) return;
    setTypeChanging(true);
    try {
      await adminRoomApi.changeType(detail.room_id, Number(selectedTypeId));
      await loadDetail();
      toast('Đã cập nhật loại phòng');
    } catch (e: any) {
      toast(e.message ?? 'Cập nhật thất bại', 'error');
    } finally { setTypeChanging(false); }
  };

  const handleQuickAdd = async () => {
    if (!quickForm.name || !quickForm.base_price) { setQuickError('Vui lòng nhập tên và giá'); return; }
    if (!detail) return;
    setQuickSaving(true); setQuickError('');
    try {
      await adminRoomApi.retypeRoom(detail.room_id, {
        name: quickForm.name,
        base_price: Number(quickForm.base_price),
        capacity: Number(quickForm.capacity),
        category_id: quickForm.category_id ? Number(quickForm.category_id) : null,
        area_sqm: quickForm.area_sqm ? Number(quickForm.area_sqm) : null,
        bed_id: quickForm.bed_id ? Number(quickForm.bed_id) : null,
        bed_quantity: Number(quickForm.bed_quantity),
      });
      setShowQuickAdd(false);
      setQuickForm({ name: '', base_price: '', capacity: '2', category_id: '', area_sqm: '', bed_id: '', bed_quantity: '1' });
      const newTypes = await roomApi.list();
      setRoomTypes(newTypes);
      await loadDetail();
      toast('Đã tạo cấu hình mới và gán cho phòng');
    } catch (e: any) {
      setQuickError(e.message ?? 'Có lỗi xảy ra');
    } finally { setQuickSaving(false); }
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
  if (!detail) return (
    <div className="text-center py-20 text-gray-400">Không tìm thấy phòng</div>
  );

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === form.status) ?? STATUS_OPTIONS[0];
  const typeChanged = selectedTypeId !== String(detail.type_id);

  return (
    <>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500 flex-wrap">
        <Link to="/admin/rooms" className="hover:text-blue-600">Loại phòng</Link>
        <span>/</span>
        <Link to={`/admin/rooms/${typeId}`} className="hover:text-blue-600">Chi tiết loại</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Phòng {detail.room_number}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <BedDouble className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Phòng {detail.room_number}</h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              Tầng {detail.floor}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </p>
          </div>
        </div>
        <Link to={`/admin/rooms/${typeId}`} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
          <ChevronLeft className="h-4 w-4" /> Quay lại
        </Link>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'info',     label: 'Thông tin',  icon: BedDouble },
          { key: 'images',   label: `Ảnh (${images.length})`, icon: ImageIcon },
          { key: 'bookings', label: `Lịch sử đặt (${bookings.length})`, icon: CalendarCheck },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === key ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Info ── */}
      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — basic info */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-5">Thông tin cơ bản</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Số phòng</label>
                <input value={form.room_number} onChange={(e) => setForm((f) => ({ ...f, room_number: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Tầng</label>
                <input type="number" min={1} value={form.floor} onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Trạng thái</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, status: s.value }))}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
                        ${form.status === s.value
                          ? `${s.cls} ring-2 ring-offset-1 ring-current shadow-sm`
                          : 'border-gray-200 text-gray-400 bg-white hover:border-gray-300 hover:text-gray-600'
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${form.status === s.value ? s.dot : 'bg-gray-300'}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Mô tả phòng</label>
                <textarea value={form.room_note} onChange={(e) => setForm((f) => ({ ...f, room_note: e.target.value }))}
                  rows={3} placeholder="Nhập mô tả chi tiết..." className={inputCls + ' resize-none'} />
              </div>
              <Button fullWidth onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </Card>

          {/* Right — room type config */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Cấu hình loại phòng</h2>
                <button onClick={() => { setShowQuickAdd((v) => !v); setQuickError(''); setQuickAutoName(true); }}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    showQuickAdd ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Settings2 className="h-3.5 w-3.5" /> Tùy chỉnh giường cho phòng này
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Loại phòng (Gói cấu hình)</label>
                <select value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)} className={inputCls}>
                  {roomTypes.map((t) => (
                    <option key={t.type_id} value={t.type_id}>{t.type_name}</option>
                  ))}
                </select>
              </div>

              {/* Preview thông tin loại được chọn (read-only) */}
              {previewType && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Giá cơ bản</p>
                      <p className="text-sm font-bold text-blue-600">{formatVND(previewType.base_price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Sức chứa</p>
                      <p className="text-sm font-semibold text-gray-900">{previewType.capacity} khách</p>
                    </div>
                    {previewType.area_sqm && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Diện tích</p>
                        <p className="text-sm font-semibold text-gray-900">{previewType.area_sqm} m²</p>
                      </div>
                    )}
                    {previewType.category_name && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Hạng</p>
                        <Badge variant="blue">{previewType.category_name}</Badge>
                      </div>
                    )}
                  </div>
                  {previewType.beds && previewType.beds.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1.5">Cấu hình giường</p>
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <BedDouble className="h-4 w-4 text-blue-500" />
                        {previewType.beds.map((b) => `${b.quantity} ${b.name}`).join(' + ')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {typeChanged && (
                <Button fullWidth onClick={handleChangeType} disabled={typeChanging} variant="secondary">
                  {typeChanging ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  Áp dụng loại phòng này
                </Button>
              )}
            </Card>

            {/* Quick-add new type panel */}
            {showQuickAdd && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Settings2 className="h-4 w-4 text-orange-500" />
                  <h3 className="font-semibold text-gray-900">Tạo cấu hình mới</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Tạo loại phòng mới và gán ngay cho phòng này. Các phòng khác không bị ảnh hưởng.
                </p>
                {quickError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {quickError}
                  </div>
                )}
                <div className="space-y-3">
                  {/* 1. Hạng phòng */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hạng phòng</label>
                    <select value={quickForm.category_id}
                      onChange={(e) => setQuickForm((f) => ({ ...f, category_id: e.target.value }))}
                      className={inputCls}>
                      <option value="">-- Chọn hạng --</option>
                      {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* 2. Loại giường — chọn xong số lượng tự reset về 1 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Loại giường</label>
                    <select value={quickForm.bed_id}
                      onChange={(e) => setQuickForm((f) => ({ ...f, bed_id: e.target.value, bed_quantity: '1' }))}
                      className={inputCls}>
                      <option value="">-- Chọn loại giường --</option>
                      {bedTypes.map((bt) => <option key={bt.bed_id} value={bt.bed_id}>{bt.name}</option>)}
                    </select>
                  </div>

                  {/* Số lượng giường — chỉ hiện khi đã chọn loại */}
                  {quickForm.bed_id && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Số lượng giường</label>
                      <input type="number" min={1} max={10} value={quickForm.bed_quantity}
                        onChange={(e) => setQuickForm((f) => ({ ...f, bed_quantity: String(Math.max(1, Number(e.target.value))) }))}
                        className={inputCls} />
                    </div>
                  )}

                  {/* 3. Tên — tự động từ hạng + giường */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                      Tên loại phòng *
                      {quickAutoName && <span className="text-xs font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Tự động</span>}
                    </label>
                    <input value={quickForm.name}
                      onChange={(e) => { setQuickAutoName(false); setQuickForm((f) => ({ ...f, name: e.target.value })); }}
                      placeholder="VD: Deluxe - King..." className={inputCls} />
                    {!quickAutoName && (
                      <button type="button" onClick={() => setQuickAutoName(true)}
                        className="mt-1 text-xs text-blue-500 hover:underline">
                        Tự động từ hạng + giường
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Giá / đêm (VNĐ) *</label>
                      <input type="number" min={0} value={quickForm.base_price}
                        onChange={(e) => setQuickForm((f) => ({ ...f, base_price: String(Math.max(0, Number(e.target.value))) }))}
                        placeholder="1500000" className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Sức chứa</label>
                      <input type="number" min={1} max={20} value={quickForm.capacity}
                        onChange={(e) => setQuickForm((f) => ({ ...f, capacity: String(Math.max(1, Number(e.target.value))) }))}
                        className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Diện tích (m²)</label>
                    <input type="number" min={1} value={quickForm.area_sqm}
                      onChange={(e) => setQuickForm((f) => ({ ...f, area_sqm: e.target.value ? String(Math.max(1, Number(e.target.value))) : '' }))}
                      placeholder="35" className={inputCls} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button fullWidth onClick={handleQuickAdd} disabled={quickSaving}>
                      {quickSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                      Tạo & Gán cho phòng này
                    </Button>
                    <button onClick={() => setShowQuickAdd(false)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Images ── */}
      {tab === 'images' && (
        <Card>
          <div className="mb-5 space-y-2">
            <label className="block text-xs font-medium text-gray-700">Thêm ảnh qua URL</label>
            <div className="flex gap-2">
              <input value={imgUrl}
                onChange={(e) => { setImgUrl(e.target.value); setPreview(e.target.value.trim()); setImgError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                placeholder="https://example.com/image.jpg"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddImage} disabled={imgSaving || !imgUrl.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-sm font-medium">
                {imgSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Thêm
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
                  <img src={img.url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover group-hover:brightness-75 transition" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => handleDeleteImage(img.image_id)}
                      className="bg-red-600 text-white rounded-full p-2 hover:bg-red-700 shadow-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">#{idx + 1}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Tab: Bookings ── */}
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
                  <th className="px-5 py-3 font-medium">Mã đặt phòng</th>
                  <th className="px-5 py-3 font-medium">Khách hàng</th>
                  <th className="px-5 py-3 font-medium">Nhận phòng</th>
                  <th className="px-5 py-3 font-medium">Trả phòng</th>
                  <th className="px-5 py-3 font-medium">Trạng thái</th>
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
                      <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(b.check_in).toLocaleDateString('vi-VN')}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(b.check_out).toLocaleDateString('vi-VN')}</td>
                      <td className="px-5 py-3.5"><Badge variant={st.variant}>{st.label}</Badge></td>
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
