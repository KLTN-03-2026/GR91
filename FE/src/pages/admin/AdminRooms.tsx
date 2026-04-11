import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Loader2, X, Check, Settings } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Link } from 'react-router-dom';
import { roomApi, type ApiRoom, type RoomCategory } from '../../lib/api';
import { formatVND } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';

const EMPTY_FORM = {
  name: '', description: '', base_price: '', capacity: '2',
  category_id: '', area_sqm: '',
};

interface FormBed {
  bed_id: number;
  quantity: number;
}

export const AdminRooms: React.FC = () => {
  const [rooms, setRooms]           = useState<ApiRoom[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [bedTypes, setBedTypes]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [modal, setModal]           = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing]       = useState<ApiRoom | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formBeds, setFormBeds]     = useState<FormBed[]>([]);
  const [autoName, setAutoName]     = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [deleteId, setDeleteId]     = useState<number | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([roomApi.list(), roomApi.listCategories(), roomApi.listBedTypes()])
      .then(([r, c, bt]) => { 
        setRooms(r); 
        setCategories(c);
        setBedTypes(bt);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Logic tạo tên tự động chuyên nghiệp
  const generateRoomName = (catId: string, beds: FormBed[]) => {
    const cat = categories.find(c => String(c.category_id) === catId);
    if (!cat) return '';

    const catName = cat.name;

    if (beds.length === 1) {
      const b = beds[0];
      const bedType = bedTypes.find(bt => bt.bed_id === b.bed_id);
      if (bedType) {
        if (bedType.name === 'Single' && b.quantity === 2) {
          return `${catName} Twin Room`;
        }
        if (bedType.name === 'Double' && b.quantity === 1) {
          return `${catName} Double Room`;
        }
      }
    }

    return `${catName} Room`;
  };

  // Cập nhật tên tự động khi Hạng phòng hoặc Giường thay đổi
  useEffect(() => {
    if (!autoName) return;
    const newName = generateRoomName(form.category_id, formBeds);
    if (newName) setForm(f => ({ ...f, name: newName }));
  }, [form.category_id, formBeds, autoName, categories, bedTypes]);

  const filtered = rooms.filter((r) =>
    r.type_name.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormBeds([]);
    setAutoName(true);
    setEditing(null);
    setError('');
    setModal('add');
  };

  const openEdit = (r: ApiRoom) => {
    setForm({
      name: r.type_name,
      description: r.description ?? '',
      base_price: String(r.base_price),
      capacity: String(r.capacity),
      category_id: r.category_id ? String(r.category_id) : '',
      area_sqm: r.area_sqm ? String(r.area_sqm) : '',
    });
    setFormBeds(r.beds ? r.beds.map((b: any) => {
      // Tìm bed_id từ bedTypes nếu b.name được trả về
      const bt = bedTypes.find(t => t.name === b.name);
      return { bed_id: bt?.bed_id || 0, quantity: b.quantity };
    }).filter(b => b.bed_id > 0) : []);
    setAutoName(false);
    setEditing(r);
    setError('');
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.name || !form.base_price) { setError('Vui lòng điền đầy đủ thông tin bắt buộc'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        description: form.description,
        base_price: Number(form.base_price),
        capacity: Number(form.capacity),
        category_id: form.category_id ? Number(form.category_id) : null,
        area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
        beds: formBeds,
      };
      if (modal === 'add') {
        await roomApi.create(payload);
        toast('Thêm loại phòng thành công');
      } else if (editing) {
        await roomApi.update(editing.type_id, payload);
        toast('Cập nhật thành công');
      }
      setModal(null);
      load();
    } catch (e: any) {
      const msg = e.message ?? 'Có lỗi xảy ra';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }  };

  const handleDelete = async (id: number) => {
    try {
      await roomApi.remove(id);
      setDeleteId(null);
      toast('Đã xóa loại phòng');
      load();
    } catch (e: any) {
      toast(e.message ?? 'Xóa thất bại', 'error');
    }
  };

  const set = (k: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (k === 'name') setAutoName(false); // người dùng tự sửa tên → tắt auto
      setForm((f) => ({ ...f, [k]: e.target.value }));
    };

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý loại phòng</h1>
          <p className="text-sm text-gray-500">Thêm, sửa, xóa các loại phòng trong hệ thống.</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Thêm loại phòng
        </Button>
      </div>

      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Tìm kiếm..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 w-16"></th>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Tên loại phòng</th>
                  <th className="px-5 py-3 font-medium">Hạng</th>
                  <th className="px-5 py-3 font-medium">Giường</th>
                  <th className="px-5 py-3 font-medium">Diện tích</th>
                  <th className="px-5 py-3 font-medium">Giá cơ bản</th>
                  <th className="px-5 py-3 font-medium">Tiện nghi</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-gray-400">Không có dữ liệu</td></tr>
                ) : filtered.map((room) => (
                  <tr key={room.type_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      {room.image
                        ? <img src={room.image} alt={room.type_name} className="w-14 h-10 object-cover rounded-lg border border-gray-100" referrerPolicy="no-referrer" />
                        : <div className="w-14 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xs">No img</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">#{room.type_id}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-900">{room.type_name}</p>
                      {room.description && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{room.description}</p>}
                    </td>
                    <td className="px-5 py-4">
                      {room.category_name
                        ? <Badge variant="blue">{room.category_name}</Badge>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {room.beds?.length
                        ? room.beds.map((b) => `${b.quantity} ${b.name}`).join(' + ')
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {room.area_sqm ? `${room.area_sqm} m²` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-gray-700">{formatVND(room.base_price)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {room.amenities.slice(0, 3).map((a) => (
                          <Badge key={a} variant="gray">{typeof a === 'string' ? a : (a as any).name}</Badge>
                        ))}
                        {room.amenities.length > 3 && <Badge variant="gray">+{room.amenities.length - 3}</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link to={`/admin/rooms/${room.type_id}`}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Quản lý phòng & tiện nghi">
                          <Settings className="h-4 w-4" />
                        </Link>
                        <button onClick={() => openEdit(room)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(room.type_id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Thêm loại phòng' : 'Sửa loại phòng'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}

            {/* Hạng + Diện tích */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hạng phòng">
                <select value={form.category_id} onChange={set('category_id')} className={inputCls}>
                  <option value="">-- Chọn hạng --</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Diện tích (m²)">
                <input type="number" value={form.area_sqm} onChange={set('area_sqm')} placeholder="VD: 35" min={1} className={inputCls} />
              </Field>
            </div>

            {/* Tên — tự động hoặc tay */}
            <Field label={
              <span className="flex items-center gap-2">
                Tên loại phòng *
                {autoName && (
                  <span className="text-xs font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Tự động</span>
                )}
              </span> as any
            }>
              <input value={form.name} onChange={set('name')}
                placeholder="VD: Deluxe - 1 King..."
                className={inputCls} />
              {!autoName && (
                <button type="button" onClick={() => setAutoName(true)}
                  className="mt-1 text-xs text-blue-500 hover:underline">
                  Tự động từ hạng + giường
                </button>
              )}
            </Field>

            <Field label="Mô tả">
              <textarea value={form.description} onChange={set('description')} rows={2}
                placeholder="Mô tả ngắn về loại phòng" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Giá cơ bản (VNĐ) *">
                <input type="number" value={form.base_price} onChange={set('base_price')} placeholder="1000000" className={inputCls} />
              </Field>
              <Field label="Sức chứa (khách)">
                <input type="number" value={form.capacity} onChange={set('capacity')} min={1} max={20} className={inputCls} />
              </Field>
            </div>

            {/* Giường — Quản lý mảng dynamic */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Cấu hình giường</label>
                <button type="button" onClick={() => setFormBeds([...formBeds, { bed_id: 0, quantity: 1 }])}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Thêm giường
                </button>
              </div>
              
              <div className="space-y-3">
                {formBeds.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2 italic">Chưa có thông tin giường</p>
                )}
                {formBeds.map((b, idx) => (
                  <div key={idx} className="flex gap-2 items-end animate-in fade-in slide-in-from-top-1">
                    <div className="flex-1">
                      <select value={b.bed_id} 
                        onChange={(e) => {
                          const newBeds = [...formBeds];
                          newBeds[idx].bed_id = Number(e.target.value);
                          setFormBeds(newBeds);
                        }}
                        className={inputCls}>
                        <option value={0}>-- Loại giường --</option>
                        {bedTypes.map(bt => <option key={bt.bed_id} value={bt.bed_id}>{bt.name}</option>)}
                      </select>
                    </div>
                    <div className="w-20">
                      <input type="number" min={1} value={b.quantity}
                        onChange={(e) => {
                          const newBeds = [...formBeds];
                          newBeds[idx].quantity = Number(e.target.value);
                          setFormBeds(newBeds);
                        }}
                        className={inputCls + ' text-center'} />
                    </div>
                    <button type="button" onClick={() => setFormBeds(formBeds.filter((_, i) => i !== idx))}
                      className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setModal(null)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
              {modal === 'add' ? 'Thêm' : 'Lưu thay đổi'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <Modal title="Xác nhận xóa" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-6">Bạn có chắc muốn xóa loại phòng này? Hành động này không thể hoàn tác.</p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Hủy</Button>
            <button onClick={() => handleDelete(deleteId)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors">
              Xóa
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
