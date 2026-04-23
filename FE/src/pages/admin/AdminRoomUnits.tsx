import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Loader2, Plus, Trash2, Edit2, Check, X,
  ExternalLink, DollarSign, RotateCcw, LayoutGrid, List, CalendarDays,
  AlertCircle, Wifi, WifiOff, RefreshCw, Clock, LogIn, LogOut, User,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { roomApi, adminRoomApi, type ApiRoom, type RoomDisplayUnit } from '../../lib/api';
import { formatVND } from '../../lib/utils';

// ─── Config ───────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000; // polling mỗi 30 giây

const DISPLAY_CFG = {
  AVAILABLE:   {
    label: 'Phòng trống',
    dot:   'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    tile:  'border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80',
    icon:  '🟢',
  },
  BOOKED:      {
    label: 'Đang có khách',
    dot:   'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    tile:  'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80',
    icon:  '🔒',
  },
  CLEANING:    {
    label: 'Đang dọn phòng',
    dot:   'bg-yellow-400',
    badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    tile:  'border-yellow-200 bg-yellow-50/70 text-yellow-800 hover:bg-yellow-100/80',
    icon:  '🧹',
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    dot:   'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600 border-gray-300',
    tile:  'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200/80',
    icon:  '🔧',
  },
  INACTIVE:    {
    label: 'Ngừng hoạt động',
    dot:   'bg-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200',
    tile:  'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-100/80',
    icon:  '⛔',
  },
} as const;

const DB_STATUS_CFG = {
  ACTIVE:      { label: 'Hoạt động' },
  INACTIVE:    { label: 'Ngừng hoạt động' },
  MAINTENANCE: { label: 'Bảo trì' },
  CLEANING:    { label: 'Đang dọn phòng' },
} as const;

const sel = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500';
const today = () => new Date().toISOString().split('T')[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

/** Tính "còn bao lâu" tới check-out */
function timeUntilCheckout(checkoutDate: string | null, checkoutTime: string): string | null {
  if (!checkoutDate) return null;
  const [h, m] = checkoutTime.split(':').map(Number);
  const dt = new Date(checkoutDate);
  dt.setHours(h, m, 0, 0);
  const diff = dt.getTime() - Date.now();
  if (diff < 0) return 'Quá giờ';
  const hours = Math.floor(diff / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  if (hours === 0) return `${mins} phút`;
  return `${hours}h${mins > 0 ? mins + 'm' : ''}`;
}

/** Badge nhỏ nguồn giá */
function PriceTag({ eff, base }: { eff: number; base: number }) {
  if (eff !== base)
    return <span className="text-xs px-1 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-200 font-medium">Room</span>;
  return <span className="text-xs px-1 py-0.5 rounded bg-gray-100 text-gray-400 border border-gray-200">Base</span>;
}

// ─── Room Chip (grid mode) ────────────────────────────────────────────────────
function RoomChip({
  u, isOpen, onClick, isUpdated,
}: {
  u: RoomDisplayUnit; isOpen: boolean; onClick: () => void; isUpdated: boolean;
}) {
  const cfg = DISPLAY_CFG[u.display_status];

  // Sắp check-out trong 1h?
  const remaining = u.booking ? timeUntilCheckout(u.booking.check_out, u.booking.check_out_time) : null;
  const isSoonCheckout = u.booking && remaining &&
    !remaining.includes('h') && !remaining.includes('Quá') &&
    Number(remaining.replace(' phút', '')) <= 60;

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left
        transition-all duration-200 select-none min-w-[88px]
        ${isOpen
          ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-100'
          : isSoonCheckout
            ? 'border-red-300 bg-red-50 text-red-800 shadow-sm animate-pulse'
            : `${cfg.tile} shadow-sm`
        }
        ${isUpdated ? 'ring-4 ring-yellow-400 border-yellow-400 bg-yellow-50 shadow-lg shadow-yellow-100 z-10 scale-105' : ''}
      `}
    >
      {/* Room number + icon */}
      <div className="flex items-center gap-1.5 w-full">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-blue-400' : cfg.dot}`} />
        <span className="text-sm font-bold leading-none">{u.room_number}</span>
        {isSoonCheckout && (
          <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-semibold leading-none">Sắp trả</span>
        )}
      </div>
      {/* Status label */}
      <span className="text-xs opacity-75 leading-none pl-0.5">{cfg.label}</span>
      {/* Booking time (nếu có khách) */}
      {u.booking && (
        <div className="text-xs font-mono leading-none pl-0.5 flex items-center gap-1 opacity-80">
          <LogIn className="h-3 w-3" />
          <span>{u.booking.check_in_time}</span>
          <span className="opacity-40">·</span>
          <LogOut className="h-3 w-3" />
          <span>{u.booking.check_out_time}</span>
        </div>
      )}
    </button>
  );
}

// ─── Room Popover ─────────────────────────────────────────────────────────────
function RoomPopover({ u, onClose, editId, editForm, setEditForm, editSaving, startEdit, saveEdit, setEditId,
  priceEditId, priceInput, setPriceInput, priceSaving, startPriceEdit, savePriceEdit, setPriceEditId, resetPrice, handleDelete }: {
  u: RoomDisplayUnit; onClose: () => void;
  editId: number | null; editForm: any; setEditForm: any; editSaving: boolean;
  startEdit: (u: RoomDisplayUnit) => void; saveEdit: (u: RoomDisplayUnit) => void; setEditId: (v: number | null) => void;
  priceEditId: number | null; priceInput: string; setPriceInput: (v: string) => void; priceSaving: boolean;
  startPriceEdit: (u: RoomDisplayUnit) => void; savePriceEdit: (u: RoomDisplayUnit) => void; setPriceEditId: (v: number | null) => void;
  resetPrice: (u: RoomDisplayUnit) => void; handleDelete: (u: RoomDisplayUnit) => void;
}) {
  const isEditing = editId === u.room_id;
  const isPriceEditing = priceEditId === u.room_id;
  const dcfg = DISPLAY_CFG[u.display_status];

  const remaining = u.booking
    ? timeUntilCheckout(u.booking.check_out, u.booking.check_out_time)
    : null;

  return (
    <div className="absolute top-full left-0 mt-2 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div>
          <p className="text-sm font-bold text-gray-900">Phòng {u.room_number}</p>
          <Link to={`/admin/rooms/${u.type_id}`} className="text-xs text-blue-500 hover:underline">{u.type_name}</Link>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${dcfg.badge}`}>
          {dcfg.icon} {dcfg.label}
        </span>
      </div>

      {/* Booking info (nếu đang có khách) */}
      {u.booking && (
        <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-100">
          <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Thông tin khách
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1 text-gray-600">
              <LogIn className="h-3 w-3 text-emerald-500" />
              <span className="text-gray-400">Nhận:</span>
              <span className="font-medium">{fmtDate(u.booking.check_in)} {u.booking.check_in_time}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <LogOut className="h-3 w-3 text-red-400" />
              <span className="text-gray-400">Trả:</span>
              <span className="font-medium">{fmtDate(u.booking.check_out)} {u.booking.check_out_time}</span>
            </div>
          </div>
          {remaining && (
            <div className={`mt-2 text-xs font-medium flex items-center gap-1.5 ${remaining === 'Quá giờ' ? 'text-red-600' : 'text-amber-700'}`}>
              <Clock className="h-3.5 w-3.5" />
              {remaining === 'Quá giờ' ? 'Đã quá giờ trả phòng!' : `Còn ${remaining} đến giờ trả phòng`}
            </div>
          )}
        </div>
      )}

      {/* Detail */}
      <div className="px-4 py-3 space-y-1.5 text-xs text-gray-600">
        <div className="flex justify-between"><span className="text-gray-400">Tầng</span><span className="font-medium">{u.floor}</span></div>
        {u.beds?.length ? (
          <div className="flex justify-between">
            <span className="text-gray-400">Giường</span>
            <span className="font-medium">{u.beds.map((b) => `${b.quantity} ${b.name}`).join(', ')}</span>
          </div>
        ) : null}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Giá / đêm</span>
          {isPriceEditing ? (
            <div className="flex items-center gap-1">
              <input type="number" min={0} value={priceInput} autoFocus onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && savePriceEdit(u)}
                className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => savePriceEdit(u)} disabled={priceSaving} className="text-green-600 hover:bg-green-50 p-1 rounded">
                {priceSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </button>
              <button onClick={() => setPriceEditId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-900">{formatVND(u.effective_price ?? u.base_price ?? 0)}</span>
              <button onClick={() => startPriceEdit(u)} className="text-gray-300 hover:text-orange-500 p-0.5 rounded"><DollarSign className="h-3 w-3" /></button>
            </div>
          )}
        </div>
        {u.room_note && (
          <div className="flex justify-between">
            <span className="text-gray-400">Ghi chú</span>
            <span className="font-medium text-right max-w-[160px] truncate">{u.room_note}</span>
          </div>
        )}
      </div>

      {/* Edit form */}
      {isEditing && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Số phòng</label>
              <input value={editForm.room_number} onChange={(e) => setEditForm((f: any) => ({ ...f, room_number: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="w-16">
              <label className="text-xs text-gray-500 mb-1 block">Tầng</label>
              <input type="number" min={1} value={editForm.floor} onChange={(e) => setEditForm((f: any) => ({ ...f, floor: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Trạng thái phòng</label>
            <select value={editForm.status} onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(DB_STATUS_CFG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
            <input value={editForm.room_note} onChange={(e) => setEditForm((f: any) => ({ ...f, room_note: e.target.value }))}
              placeholder="Ghi chú..." className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        {isEditing ? (
          <div className="flex gap-2">
            <button onClick={() => saveEdit(u)} disabled={editSaving}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Lưu
            </button>
            <button onClick={() => setEditId(null)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">Hủy</button>
          </div>
        ) : (
          <div className="flex gap-1">
            <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            <Link to={`/admin/rooms/${u.type_id}/units/${u.room_id}`} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><ExternalLink className="h-3.5 w-3.5" /></Link>
            <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 p-1 rounded"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const AdminRoomUnits: React.FC = () => {
  const [units, setUnits]     = useState<RoomDisplayUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(today());
  const [search, setSearch]   = useState('');
  const [filterFloor, setFilterFloor]   = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [roomTypes, setRoomTypes]       = useState<ApiRoom[]>([]);
  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('grid');
  const [expandedId, setExpandedId]     = useState<number | null>(null);
  const [addModal, setAddModal]         = useState(false);
  const [addForm, setAddForm]           = useState({ type_id: '', room_number: '', floor: '1' });
  const [addSaving, setAddSaving]       = useState(false);
  const [addError, setAddError]         = useState('');
  const [editId, setEditId]             = useState<number | null>(null);
  const [editForm, setEditForm]         = useState({ room_number: '', floor: '', status: '', room_note: '' });
  const [editSaving, setEditSaving]     = useState(false);
  const [priceEditId, setPriceEditId]   = useState<number | null>(null);
  const [priceInput, setPriceInput]     = useState('');
  const [priceSaving, setPriceSaving]   = useState(false);

  // Realtime polling
  const [connected, setConnected]       = useState(false);
  const [lastSync, setLastSync]         = useState<Date | null>(null);
  const [updatedIds, setUpdatedIds]     = useState<Set<number>>(new Set());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toast = useToast();

  // ─── Data fetch ─────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async (d = date, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const statusUnits = await adminRoomApi.listUnitsStatus(d);
      setUnits((prev) => {
        // Track các room vừa thay đổi (chỉ khi polling, không lần đầu)
        if (prev.length > 0) {
          const changed = new Set<number>();
          statusUnits.forEach((u) => {
            const old = prev.find((p) => p.room_id === u.room_id);
            if (old && old.display_status !== u.display_status) changed.add(u.room_id);
          });
          if (changed.size > 0) {
            setUpdatedIds(changed);
            setTimeout(() => setUpdatedIds(new Set()), 3000); // clear sau 3s
          }
        }
        return statusUnits;
      });
      setConnected(true);
      setLastSync(new Date());
    } catch {
      setConnected(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date]);

  const load = useCallback(async (d = date) => {
    setLoading(true);
    try {
      const [types] = await Promise.all([roomApi.list(), fetchStatus(d, true)]);
      setRoomTypes(types);
    } finally {
      setLoading(false);
    }
  }, [date, fetchStatus]);

  // Initial load
  useEffect(() => { load(); }, [date]);

  // Polling interval
  useEffect(() => {
    pollingRef.current = setInterval(() => fetchStatus(date, true), POLL_INTERVAL_MS);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [date, fetchStatus]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.type_id) { setAddError('Vui lòng chọn loại phòng'); return; }
    const rn = addForm.room_number.trim();
    if (!rn) { setAddError('Vui lòng nhập số phòng'); return; }
    if (rn.length > 10) { setAddError('Số phòng tối đa 10 ký tự'); return; }
    if (!/^[a-zA-Z0-9]+$/.test(rn)) { setAddError('Số phòng chỉ được chứa chữ và số, không có khoảng trắng'); return; }
    const floor = Number(addForm.floor);
    if (!floor || floor < 1 || floor > 99) { setAddError('Tầng phải từ 1 đến 99'); return; }
    if (units.some((u) => u.room_number.toLowerCase() === rn.toLowerCase())) {
      setAddError(`Số phòng "${rn}" đã tồn tại trong hệ thống`); return;
    }
    setAddSaving(true); setAddError('');
    try {
      await adminRoomApi.addUnit(addForm.type_id, { room_number: rn, floor });
      setAddModal(false);
      setAddForm({ type_id: '', room_number: '', floor: '1' });
      await load();
      toast(`Đã thêm phòng ${rn} thành công`);
    } catch (e: any) {
      const msg: string = e.message ?? '';
      setAddError(msg.includes('đã tồn tại') || msg.includes('409')
        ? `Số phòng "${rn}" đã tồn tại.`
        : msg || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally { setAddSaving(false); }
  };

  const startEdit = (u: RoomDisplayUnit) => {
    setEditId(u.room_id);
    setEditForm({ room_number: u.room_number, floor: String(u.floor), status: u.db_status, room_note: u.room_note ?? '' });
  };

  const saveEdit = async (u: RoomDisplayUnit) => {
    setEditSaving(true);
    try {
      await adminRoomApi.updateUnit(u.room_id, {
        room_number: editForm.room_number, floor: Number(editForm.floor),
        status: editForm.status, room_note: editForm.room_note || undefined,
      });
      await fetchStatus(date, true); setEditId(null);
      toast(`Đã cập nhật phòng ${editForm.room_number}`);
    } catch (e: any) {
      toast(e.message ?? 'Cập nhật thất bại', 'error');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async (u: RoomDisplayUnit) => {
    if (!confirm(`Xóa phòng ${u.room_number}?`)) return;
    try {
      await adminRoomApi.deleteUnit(u.room_id);
      setUnits((prev) => prev.filter((x) => x.room_id !== u.room_id));
      setExpandedId(null);
      toast(`Đã xóa phòng ${u.room_number}`);
    } catch (e: any) { toast(e.message ?? 'Xóa thất bại', 'error'); }
  };

  const startPriceEdit = (u: RoomDisplayUnit) => { setPriceEditId(u.room_id); setPriceInput(String(u.effective_price ?? u.base_price ?? '')); };

  const savePriceEdit = async (u: RoomDisplayUnit) => {
    const val = Number(priceInput);
    if (!val || val <= 0) { toast('Giá phải lớn hơn 0', 'error'); return; }
    setPriceSaving(true);
    try {
      const d = new Date().toISOString().split('T')[0];
      await adminRoomApi.setPrice(u.room_id, { price: val, start_date: d, end_date: d });
      setUnits((prev) => prev.map((x) => x.room_id === u.room_id ? { ...x, effective_price: val } : x));
      setPriceEditId(null);
      toast(`Đã cập nhật giá phòng ${u.room_number}`);
    } catch (e: any) { toast(e.message ?? 'Cập nhật giá thất bại', 'error'); }
    finally { setPriceSaving(false); }
  };

  const resetPrice = async (u: RoomDisplayUnit) => {
    if (!confirm('Đặt lại về giá gốc?')) return;
    await adminRoomApi.resetPrice(u.room_id);
    setUnits((prev) => prev.map((x) => x.room_id === u.room_id ? { ...x, effective_price: x.base_price } : x));
  };

  // ─── Derived state ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => units
    .filter((u) => !filterFloor  || String(u.floor) === filterFloor)
    .filter((u) => !filterType   || String(u.type_id) === filterType)
    .filter((u) => !filterStatus || u.display_status === filterStatus)
    .filter((u) => u.room_number.toLowerCase().includes(search.toLowerCase()) || u.type_name.toLowerCase().includes(search.toLowerCase())),
    [units, filterFloor, filterType, filterStatus, search]);

  const allFloors = useMemo(() => [...new Set(units.map((u) => u.floor))].sort((a, b) => Number(a) - Number(b)), [units]);

  const byFloor = useMemo(() => filtered.reduce<Record<number, RoomDisplayUnit[]>>((acc, u) => {
    (acc[u.floor] ??= []).push(u); return acc;
  }, {}), [filtered]);

  const floors = Object.keys(byFloor).map(Number).sort((a, b) => a - b);

  const stats = useMemo(() => ({
    AVAILABLE:   units.filter((u) => u.display_status === 'AVAILABLE').length,
    BOOKED:      units.filter((u) => u.display_status === 'BOOKED').length,
    CLEANING:    units.filter((u) => u.display_status === 'CLEANING').length,
    MAINTENANCE: units.filter((u) => u.display_status === 'MAINTENANCE').length,
    INACTIVE:    units.filter((u) => u.display_status === 'INACTIVE').length,
  }), [units]);

  const pp = { editId, editForm, setEditForm, editSaving, startEdit, saveEdit, setEditId,
    priceEditId, priceInput, setPriceInput, priceSaving, startPriceEdit, savePriceEdit, setPriceEditId,
    resetPrice, handleDelete };

  const rs = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quản lý phòng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sơ đồ trạng thái phòng theo thời gian thực</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Realtime indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium
            ${connected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
            {connected
              ? <><Wifi className="h-3.5 w-3.5" /><span>Realtime &middot; {lastSync?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></>
              : <><WifiOff className="h-3.5 w-3.5" /><span>Mất kết nối</span></>}
          </div>
          <button onClick={() => fetchStatus(date, false)} title="Làm mới"
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <Button size="sm" onClick={() => { setAddModal(true); setAddError(''); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Thêm phòng
          </Button>
        </div>
      </div>

      {/* Stats cards — clickable để filter */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {(Object.keys(DISPLAY_CFG) as (keyof typeof DISPLAY_CFG)[]).map((key) => {
          const cfg = DISPLAY_CFG[key];
          return (
            <button key={key}
              onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
              className={`bg-white rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all text-left
                ${filterStatus === key ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
              <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div>
                <p className="text-xs text-gray-400">{cfg.label}</p>
                <p className="text-xl font-bold text-gray-900">{stats[key]}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Card padding={false}>
        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex items-center">
              <CalendarDays className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <select value={filterFloor} onChange={(e) => setFilterFloor(e.target.value)} className={sel}>
              <option value="">Tất cả tầng</option>
              {allFloors.map((f) => <option key={f} value={String(f)}>Tầng {f}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={sel}>
              <option value="">Tất cả loại</option>
              {roomTypes.map((t) => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Tìm số phòng..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-40" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{filtered.length} phòng</span>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                <LayoutGrid className="h-3.5 w-3.5" /> Sơ đồ
              </button>
              <button onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                <List className="h-3.5 w-3.5" /> Danh sách
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-2 border-b border-gray-50 flex flex-wrap gap-5 text-xs text-gray-400">
          {(Object.values(DISPLAY_CFG)).map((cfg) => (
            <span key={cfg.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} /> {cfg.icon} {cfg.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-red-400 ml-auto">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Sắp trả phòng (&lt;1h)
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-400">Không tìm thấy phòng nào</div>
        ) : viewMode === 'grid' ? (
          /* ── Grid (chip) mode ── */
          <div className="divide-y divide-gray-50">
            {floors.map((floor) => (
              <div key={floor} className="px-5 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Tầng {floor} <span className="ml-1 font-normal normal-case text-gray-300">({byFloor[floor].length} phòng)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {byFloor[floor].map((u) => {
                    const isOpen = expandedId === u.room_id;
                    return (
                      <div key={u.room_id} className="relative">
                        <RoomChip
                          u={u}
                          isOpen={isOpen}
                          onClick={() => setExpandedId(isOpen ? null : u.room_id)}
                          isUpdated={updatedIds.has(u.room_id)}
                        />
                        {isOpen && (
                          <RoomPopover u={u} onClose={() => setExpandedId(null)} {...pp} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── List mode ── */
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">Phòng</th>
                <th className="px-5 py-3">Loại phòng</th>
                <th className="px-5 py-3">Tầng</th>
                <th className="px-5 py-3">Giường</th>
                <th className="px-5 py-3">Giá / đêm</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Check-in / out</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isEditing = editId === u.room_id;
                const isPriceEditing = priceEditId === u.room_id;
                const dcfg = DISPLAY_CFG[u.display_status];
                const isUpdated = updatedIds.has(u.room_id);
                return (
                  <tr key={u.room_id}
                    className={`border-t border-gray-100 hover:bg-gray-50 transition-colors ${isUpdated ? 'bg-yellow-50' : ''}`}>
                    <td className="px-5 py-3">
                      {isEditing
                        ? <input value={editForm.room_number} onChange={(e) => setEditForm((f: any) => ({ ...f, room_number: e.target.value }))} className={`${rs} w-24`} />
                        : <span className="text-sm font-semibold text-gray-900">Phòng {u.room_number}</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Link to={`/admin/rooms/${u.type_id}`} className="text-sm text-blue-600 hover:underline">{u.type_name}</Link>
                    </td>
                    <td className="px-5 py-3">
                      {isEditing
                        ? <input type="number" min={1} value={editForm.floor} onChange={(e) => setEditForm((f: any) => ({ ...f, floor: e.target.value }))} className={`${rs} w-16`} />
                        : <span className="text-sm text-gray-600">Tầng {u.floor}</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">
                      {u.beds?.length ? u.beds.map((b) => `${b.quantity} ${b.name}`).join(', ') : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      {isPriceEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} value={priceInput} autoFocus onChange={(e) => setPriceInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && savePriceEdit(u)} className={`${rs} w-32`} />
                          <button onClick={() => savePriceEdit(u)} disabled={priceSaving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                            {priceSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => setPriceEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group/price">
                          <span className="text-sm font-semibold text-gray-900">{formatVND(u.effective_price ?? u.base_price ?? 0)}</span>
                          <PriceTag eff={u.effective_price ?? 0} base={u.base_price ?? 0} />
                          <div className="flex gap-0.5 opacity-0 group-hover/price:opacity-100 transition-opacity">
                            <button onClick={() => startPriceEdit(u)} className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"><DollarSign className="h-3.5 w-3.5" /></button>
                            <button onClick={() => resetPrice(u)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"><RotateCcw className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <select value={editForm.status} onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))} className={rs}>
                          {Object.entries(DB_STATUS_CFG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${dcfg.badge}`}>
                          {dcfg.icon} {dcfg.label}
                        </span>
                      )}
                    </td>
                    {/* Check-in / out column */}
                    <td className="px-5 py-3">
                      {u.booking ? (
                        <div className="text-xs space-y-0.5">
                          <div className="flex items-center gap-1 text-gray-600">
                            <LogIn className="h-3 w-3 text-emerald-500" />
                            <span>{fmtDate(u.booking.check_in)} {u.booking.check_in_time}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-600">
                            <LogOut className="h-3 w-3 text-red-400" />
                            <span>{fmtDate(u.booking.check_out)} {u.booking.check_out_time}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(u)} disabled={editSaving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </button>
                            <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="h-4 w-4" /></button>
                            <Link to={`/admin/rooms/${u.type_id}/units/${u.room_id}`} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><ExternalLink className="h-4 w-4" /></Link>
                            <button onClick={() => handleDelete(u)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
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
              {addError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{addError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Loại phòng <span className="text-red-500">*</span></label>
                <select value={addForm.type_id}
                  onChange={(e) => { setAddForm((f) => ({ ...f, type_id: e.target.value })); setAddError(''); }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${!addForm.type_id && addError ? 'border-red-300' : 'border-gray-200'}`}>
                  <option value="">-- Chọn loại phòng --</option>
                  {roomTypes.map((t) => <option key={t.type_id} value={String(t.type_id)}>{t.type_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Số phòng <span className="text-red-500">*</span></label>
                <input value={addForm.room_number}
                  onChange={(e) => { setAddForm((f) => ({ ...f, room_number: e.target.value })); setAddError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="VD: 101, 202A, P301..."
                  maxLength={10}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${addError && !addForm.room_number.trim() ? 'border-red-300' : 'border-gray-200'}`}
                />
                <p className="text-xs text-gray-400 mt-1">Chỉ chữ và số, tối đa 10 ký tự</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Tầng</label>
                <input type="number" min={1} max={99} value={addForm.floor}
                  onChange={(e) => { setAddForm((f) => ({ ...f, floor: e.target.value })); setAddError(''); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <Button variant="secondary" onClick={() => { setAddModal(false); setAddError(''); }}>Hủy</Button>
              <Button onClick={handleAdd} disabled={addSaving}>
                {addSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Đang thêm...</> : 'Thêm phòng'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
