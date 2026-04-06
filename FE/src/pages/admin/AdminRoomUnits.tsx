import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Loader2, Plus, Trash2, Edit2, Check, X,
  Image as ImageIcon, ChevronDown, ChevronUp, ExternalLink, DollarSign, RotateCcw,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { roomApi, adminRoomApi, type ApiRoom, type RoomUnit } from '../../lib/api';
import { formatVND } from '../../lib/utils';

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' }> = {
  ACTIVE:      { label: 'Hoạt động',       variant: 'green' },
  INACTIVE:    { label: 'Ngừng hoạt động', variant: 'yellow' },
  MAINTENANCE: { label: 'Bảo trì',         variant: 'red' },
};

interface FlatUnit extends RoomUnit {
  type_id: number;
  type_name: string;
}

interface RoomImage { image_id: number; url: string; }

const inputCls = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

// ── Image panel (inline) ──────────────────────────────────────────────────────
function ImagePanel({ roomId }: { roomId: number }) {
  const [images, setImages]   = useState<RoomImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl]         = useState('');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    adminRoomApi.listImages(roomId)
      .then(setImages)
      .finally(() => setLoading(false));
  }, [roomId]);

  const add = async () => {
    const u = url.trim();
    if (!u) return;
    setSaving(true); setErr('');
    try {
      const img = await adminRoomApi.addImage(roomId, u);
      setImages((p) => [...p, img]);
      setUrl('');
    } catch (e: any) { setErr(e.message ?? 'Lỗi'); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    await adminRoomApi.deleteImage(id);
    setImages((p) => p.filter((i) => i.image_id !== id));
  };

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>;

  return (
    <div className="px-5 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-600 mb-2">Ảnh phòng</p>

      {/* Add URL */}
      <div className="flex gap-2 mb-3">
        <input
          value={url} onChange={(e) => { setUrl(e.target.value); setErr(''); }}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Dán URL ảnh vào đây..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={add} disabled={saving || !url.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Thêm
        </button>
      </div>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}

      {images.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Chưa có ảnh nào.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={img.image_id} className="relative group w-20 h-14 rounded-lg overflow-hidden border border-gray-200">
              <img src={img.url} alt={`#${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              <button onClick={() => remove(img.image_id)}
                className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export const AdminRoomUnits: React.FC = () => {
  const [allUnits, setAllUnits]   = useState<FlatUnit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [roomTypes, setRoomTypes] = useState<ApiRoom[]>([]);

  // Add modal
  const [addModal, setAddModal]   = useState(false);
  const [addForm, setAddForm]     = useState({ type_id: '', room_number: '', floor: '1' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError]   = useState('');

  // Inline edit
  const [editId, setEditId]       = useState<number | null>(null);
  const [editForm, setEditForm]   = useState({ room_number: '', floor: '', status: '', room_note: '' });
  const [editSaving, setEditSaving] = useState(false);

  // Inline price edit
  const [priceEditId, setPriceEditId]   = useState<number | null>(null);
  const [priceInput, setPriceInput]     = useState('');
  const [priceSaving, setPriceSaving]   = useState(false);

  // Expanded image panel
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const types = await roomApi.list();
    setRoomTypes(types);
    const nested = await Promise.all(
      types.map((t) =>
        adminRoomApi.listUnits(t.type_id).then((units) =>
          units.map((u) => ({ ...u, type_id: t.type_id, type_name: t.type_name }))
        )
      )
    );
    setAllUnits(nested.flat());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Add ──────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.type_id || !addForm.room_number) { setAddError('Vui lòng chọn loại phòng và nhập số phòng'); return; }
    setAddSaving(true); setAddError('');
    try {
      await adminRoomApi.addUnit(addForm.type_id, { room_number: addForm.room_number, floor: Number(addForm.floor) });
      setAddModal(false);
      setAddForm({ type_id: '', room_number: '', floor: '1' });
      await load();
    } catch (e: any) { setAddError(e.message ?? 'Lỗi'); }
    finally { setAddSaving(false); }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────
  const startEdit = (u: FlatUnit) => {
    setEditId(u.room_id);
    setEditForm({ room_number: u.room_number, floor: String(u.floor), status: u.status, room_note: u.room_note ?? '' });
  };

  const saveEdit = async (u: FlatUnit) => {
    setEditSaving(true);
    try {
      await adminRoomApi.updateUnit(u.room_id, {
        room_number: editForm.room_number,
        floor: Number(editForm.floor),
        status: editForm.status,
        room_note: editForm.room_note || undefined,
      });
      setAllUnits((prev) => prev.map((x) =>
        x.room_id === u.room_id
          ? { ...x, room_number: editForm.room_number, floor: Number(editForm.floor), status: editForm.status as any, room_note: editForm.room_note || null }
          : x
      ));
      setEditId(null);
    } finally { setEditSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (u: FlatUnit) => {
    if (!confirm(`Xóa phòng ${u.room_number}?`)) return;
    await adminRoomApi.deleteUnit(u.room_id);
    setAllUnits((prev) => prev.filter((x) => x.room_id !== u.room_id));
  };

  // ── Price ─────────────────────────────────────────────────────────────────
  const startPriceEdit = (u: FlatUnit) => {
    setPriceEditId(u.room_id);
    setPriceInput(String(u.override_price ?? u.effective_price ?? u.base_price ?? ''));
  };

  const savePriceEdit = async (u: FlatUnit) => {
    const val = Number(priceInput);
    if (!val || val <= 0) return;
    setPriceSaving(true);
    try {
      await adminRoomApi.setPrice(u.room_id, val);
      setAllUnits((prev) => prev.map((x) =>
        x.room_id === u.room_id
          ? { ...x, override_price: val, effective_price: val }
          : x
      ));
      setPriceEditId(null);
    } finally { setPriceSaving(false); }
  };

  const resetPrice = async (u: FlatUnit) => {
    if (!confirm('Đặt lại về giá gốc của loại phòng?')) return;
    await adminRoomApi.resetPrice(u.room_id);
    setAllUnits((prev) => prev.map((x) =>
      x.room_id === u.room_id
        ? { ...x, override_price: null, effective_price: x.base_price }
        : x
    ));
  };

  const filtered = allUnits
    .filter((u) => !filterType   || String(u.type_id) === filterType)
    .filter((u) => !filterStatus || u.status === filterStatus)
    .filter((u) =>
      u.room_number.toLowerCase().includes(search.toLowerCase()) ||
      u.type_name.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý phòng</h1>
          <p className="text-sm text-gray-500">Tất cả phòng vật lý trong hệ thống.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                const res = await fetch(`${(import.meta as any).env?.VITE_API_URL ?? 'http://localhost:4000/api'}/rooms/admin/fix-images`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                });
                const d = await res.json();
                alert(`Đã sửa ${d.fixed} ảnh lỗi`);
                await load();
              } catch { alert('Lỗi khi sửa ảnh'); }
            }}
            className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Sửa ảnh lỗi
          </button>
          <Button size="sm" onClick={() => { setAddModal(true); setAddError(''); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Thêm phòng
          </Button>
        </div>
      </div>

      <Card padding={false}>
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Tìm số phòng..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-44" />
            </div>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả loại</option>
              {roomTypes.map((t) => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_MAP).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <span className="text-sm text-gray-400">{filtered.length} phòng</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 w-16"></th>
                <th className="px-5 py-3">Số phòng</th>
                <th className="px-5 py-3">Loại phòng</th>
                <th className="px-5 py-3">Tầng</th>
                <th className="px-5 py-3">Ghi chú</th>
                <th className="px-5 py-3">Giá / đêm</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">Không tìm thấy phòng nào</td></tr>
              ) : filtered.map((u) => {
                const isEditing      = editId === u.room_id;
                const isPriceEditing = priceEditId === u.room_id;
                const isExpanded     = expandedId === u.room_id;
                const st = STATUS_MAP[u.status] ?? STATUS_MAP.ACTIVE;
                const hasOverride = u.override_price != null;

                return (
                  <React.Fragment key={u.room_id}>
                    <tr className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                      {/* Thumbnail */}
                      <td className="px-5 py-3">
                        {u.first_image ? (
                          <img src={u.first_image} alt={u.room_number}
                            className="w-12 h-9 object-cover rounded-lg border border-gray-100"
                            referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                      </td>

                      {/* Số phòng */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input value={editForm.room_number}
                            onChange={(e) => setEditForm((f) => ({ ...f, room_number: e.target.value }))}
                            className={`${inputCls} w-24`} />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">Phòng {u.room_number}</span>
                        )}
                      </td>

                      {/* Loại phòng */}
                      <td className="px-5 py-3">
                        <Link to={`/admin/rooms/${u.type_id}`} className="text-sm text-blue-600 hover:underline">
                          {u.type_name}
                        </Link>
                      </td>

                      {/* Tầng */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input type="number" min={1} value={editForm.floor}
                            onChange={(e) => setEditForm((f) => ({ ...f, floor: e.target.value }))}
                            className={`${inputCls} w-16`} />
                        ) : (
                          <span className="text-sm text-gray-600">Tầng {u.floor}</span>
                        )}
                      </td>

                      {/* Ghi chú */}
                      <td className="px-5 py-3 max-w-[160px]">
                        {isEditing ? (
                          <input value={editForm.room_note}
                            onChange={(e) => setEditForm((f) => ({ ...f, room_note: e.target.value }))}
                            placeholder="Ghi chú..."
                            className={`${inputCls} w-full`} />
                        ) : (
                          <span className="text-xs text-gray-500 line-clamp-2">{u.room_note || '—'}</span>
                        )}
                      </td>

                      {/* Giá */}
                      <td className="px-5 py-3">
                        {isPriceEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number" min={0} value={priceInput}
                              onChange={(e) => setPriceInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && savePriceEdit(u)}
                              className={`${inputCls} w-32`}
                              autoFocus
                            />
                            <button onClick={() => savePriceEdit(u)} disabled={priceSaving}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              {priceSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => setPriceEditId(null)}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/price">
                            <div>
                              <span className={`text-sm font-semibold ${hasOverride ? 'text-orange-600' : 'text-gray-900'}`}>
                                {formatVND(u.effective_price ?? u.base_price ?? 0)}
                              </span>
                              {hasOverride && (
                                <p className="text-xs text-gray-400 line-through leading-none mt-0.5">
                                  {formatVND(u.base_price ?? 0)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover/price:opacity-100 transition-opacity">
                              <button onClick={() => startPriceEdit(u)}
                                className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                                title="Chỉnh giá">
                                <DollarSign className="h-3.5 w-3.5" />
                              </button>
                              {hasOverride && (
                                <button onClick={() => resetPrice(u)}
                                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="Đặt lại giá gốc">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <select value={editForm.status}
                            onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                            className={inputCls}>
                            {Object.entries(STATUS_MAP).map(([v, { label }]) => (
                              <option key={v} value={v}>{label}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant={st.variant}>{st.label}</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(u)} disabled={editSaving}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button onClick={() => setEditId(null)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : u.room_id)}
                                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium ${isExpanded ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                title="Quản lý ảnh"
                              >
                                <ImageIcon className="h-4 w-4" />
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                              <button onClick={() => startEdit(u)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <Link
                                to={`/admin/rooms/${u.type_id}/units/${u.room_id}`}
                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Chi tiết & chỉnh sửa đầy đủ"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                              <button onClick={() => handleDelete(u)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline image panel */}
                    {isExpanded && (
                      <tr className="border-t border-blue-100">
                        <td colSpan={8} className="p-0">
                          <ImagePanel roomId={u.room_id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Thêm phòng mới</h3>
              <button onClick={() => setAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {addError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{addError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Loại phòng *</label>
                <select value={addForm.type_id} onChange={(e) => setAddForm((f) => ({ ...f, type_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Chọn loại phòng --</option>
                  {roomTypes.map((t) => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Số phòng *</label>
                <input value={addForm.room_number} onChange={(e) => setAddForm((f) => ({ ...f, room_number: e.target.value }))}
                  placeholder="VD: 101, 202A..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Tầng</label>
                <input type="number" min={1} value={addForm.floor} onChange={(e) => setAddForm((f) => ({ ...f, floor: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <Button variant="secondary" onClick={() => setAddModal(false)}>Hủy</Button>
              <Button onClick={handleAdd} disabled={addSaving}>
                {addSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Thêm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
