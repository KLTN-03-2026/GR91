import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Loader2, X, ChevronLeft, BedDouble, Sparkles, Settings } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { roomApi, adminRoomApi, type ApiRoom, type RoomUnit, type Amenity, type BedType } from '../../lib/api';
import { formatVND } from '../../lib/utils';

const STATUS_MAP: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' }> = {
  ACTIVE:      { label: 'Hoạt động',       variant: 'green' },
  INACTIVE:    { label: 'Ngừng hoạt động', variant: 'yellow' },
  MAINTENANCE: { label: 'Bảo trì',         variant: 'red' },
};

interface BedRow { id: number; bed_id: number; name: string; quantity: number; }

export const AdminRoomTypes: React.FC = () => {
  const { typeId } = useParams<{ typeId: string }>();

  const [roomType, setRoomType]   = useState<ApiRoom | null>(null);
  const [units, setUnits]         = useState<RoomUnit[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [beds, setBeds]           = useState<BedRow[]>([]);
  const [bedTypes, setBedTypes]   = useState<BedType[]>([]);
  const [loading, setLoading]     = useState(true);

  // Unit modal
  const [unitModal, setUnitModal]   = useState(false);
  const [unitForm, setUnitForm]     = useState({ room_number: '', floor: '1' });
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitError, setUnitError]   = useState('');

  // Amenity
  const [amenityInput, setAmenityInput]   = useState('');
  const [amenitySaving, setAmenitySaving] = useState(false);

  // Bed
  const [bedForm, setBedForm]     = useState({ bed_id: '', quantity: '1' });
  const [bedSaving, setBedSaving] = useState(false);

  const loadAll = async () => {
    if (!typeId) return;
    setLoading(true);
    try {
      const [rt, u, a, b, bt] = await Promise.all([
        roomApi.detail(typeId),
        adminRoomApi.listUnits(typeId),
        adminRoomApi.listAmenities(typeId),
        adminRoomApi.listBeds(typeId),
        roomApi.listBedTypes(),
      ]);
      setRoomType(rt);
      setUnits(u);
      setAmenities(a);
      setBeds(b as BedRow[]);
      setBedTypes(bt);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [typeId]);

  // ── Units ──────────────────────────────────────────────────────────────────
  const handleAddUnit = async () => {
    if (!unitForm.room_number) { setUnitError('Vui lòng nhập số phòng'); return; }
    setUnitSaving(true); setUnitError('');
    try {
      await adminRoomApi.addUnit(typeId!, { room_number: unitForm.room_number, floor: Number(unitForm.floor) });
      setUnitModal(false);
      setUnitForm({ room_number: '', floor: '1' });
      setUnits(await adminRoomApi.listUnits(typeId!));
    } catch (e: any) {
      setUnitError(e.message ?? 'Lỗi khi thêm phòng');
    } finally {
      setUnitSaving(false);
    }
  };

  const handleDeleteUnit = async (roomId: number) => {
    if (!confirm('Xóa phòng này?')) return;
    await adminRoomApi.deleteUnit(roomId);
    setUnits((u) => u.filter((r) => r.room_id !== roomId));
  };

  const handleStatusChange = async (roomId: number, status: string) => {
    await adminRoomApi.updateUnit(roomId, { status });
    setUnits((u) => u.map((r) => r.room_id === roomId ? { ...r, status: status as any } : r));
  };

  // ── Amenities ──────────────────────────────────────────────────────────────
  const handleAddAmenity = async () => {
    const name = amenityInput.trim();
    if (!name) return;
    setAmenitySaving(true);
    try {
      const { amenity_id } = await adminRoomApi.addAmenity(typeId!, name);
      setAmenities((a) => [...a, { amenity_id, name }]);
      setAmenityInput('');
    } finally {
      setAmenitySaving(false);
    }
  };

  const handleDeleteAmenity = async (amenityId: number) => {
    await adminRoomApi.deleteAmenity(typeId!, amenityId);
    setAmenities((a) => a.filter((x) => x.amenity_id !== amenityId));
  };

  // ── Beds ───────────────────────────────────────────────────────────────────
  const handleAddBed = async () => {
    if (!bedForm.bed_id) return;
    setBedSaving(true);
    try {
      await adminRoomApi.addBed(typeId!, Number(bedForm.bed_id), Number(bedForm.quantity));
      setBeds(await adminRoomApi.listBeds(typeId!) as BedRow[]);
      setBedForm({ bed_id: '', quantity: '1' });
    } finally {
      setBedSaving(false);
    }
  };

  const handleDeleteBed = async (bedRowId: number) => {
    await adminRoomApi.deleteBed(typeId!, bedRowId);
    setBeds((b) => b.filter((x) => x.id !== bedRowId));
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  if (!roomType) return (
    <div className="text-center py-20 text-gray-400">Không tìm thấy loại phòng</div>
  );

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link to="/admin/rooms" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-4">
          <ChevronLeft className="h-4 w-4" /> Quay lại danh sách
        </Link>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{roomType.type_name}</h1>
              {roomType.category_name && (
                <Badge variant="blue">{roomType.category_name}</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">{roomType.description}</p>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              {roomType.area_sqm && <span>Diện tích: {roomType.area_sqm} m²</span>}
              <span>Sức chứa: {roomType.capacity} khách</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Giá cơ bản</p>
            <p className="text-lg font-bold text-blue-600">{formatVND(roomType.base_price)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Units — 2/3 */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900">Danh sách phòng ({units.length})</h2>
              </div>
              <Button size="sm" onClick={() => { setUnitModal(true); setUnitError(''); }}>
                <Plus className="h-4 w-4 mr-1" /> Thêm phòng
              </Button>
            </div>

            {units.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">Chưa có phòng nào.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-5 py-3">Số phòng</th>
                    <th className="px-5 py-3">Tầng</th>
                    <th className="px-5 py-3">Giá / đêm</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {units.map((u) => {
                    const hasOverride = u.override_price != null;
                    const st = STATUS_MAP[u.status] ?? STATUS_MAP.ACTIVE;
                    return (
                      <tr key={u.room_id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">Phòng {u.room_number}</td>
                        <td className="px-5 py-3 text-sm text-gray-600">Tầng {u.floor}</td>
                        <td className="px-5 py-3">
                          <span className={`text-sm font-semibold ${hasOverride ? 'text-orange-600' : 'text-gray-900'}`}>
                            {formatVND(u.effective_price ?? u.base_price ?? 0)}
                          </span>
                          {hasOverride && (
                            <p className="text-xs text-gray-400 line-through">{formatVND(u.base_price ?? 0)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <select value={u.status}
                            onChange={(e) => handleStatusChange(u.room_id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                            {Object.entries(STATUS_MAP).map(([val, { label }]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Link to={`/admin/rooms/${typeId}/units/${u.room_id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-200 transition-colors">
                              <Settings className="h-3.5 w-3.5" /> Quản lý
                            </Link>
                            <button onClick={() => handleDeleteUnit(u.room_id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right column — Amenities + Beds */}
        <div className="space-y-5">
          {/* Amenities */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Tiện nghi</h2>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={amenityInput} onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAmenity()}
                placeholder="Tên tiện nghi..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddAmenity} disabled={amenitySaving || !amenityInput.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {amenitySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
            {amenities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Chưa có tiện nghi nào</p>
            ) : (
              <div className="space-y-2">
                {amenities.map((a) => (
                  <div key={a.amenity_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700">{a.name}</span>
                    <button onClick={() => handleDeleteAmenity(a.amenity_id)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Beds */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BedDouble className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Loại giường</h2>
            </div>
            <div className="flex gap-2 mb-4">
              <select value={bedForm.bed_id} onChange={(e) => setBedForm((f) => ({ ...f, bed_id: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Chọn loại --</option>
                {bedTypes.map((bt) => <option key={bt.bed_id} value={bt.bed_id}>{bt.name}</option>)}
              </select>
              <input type="number" min={1} max={10} value={bedForm.quantity}
                onChange={(e) => setBedForm((f) => ({ ...f, quantity: e.target.value }))}
                className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddBed} disabled={bedSaving || !bedForm.bed_id}
                className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {bedSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
            {beds.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Chưa có loại giường nào</p>
            ) : (
              <div className="space-y-2">
                {beds.map((b) => (
                  <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700">{b.quantity} × {b.name}</span>
                    <button onClick={() => handleDeleteBed(b.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Unit Modal */}
      {unitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setUnitModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Thêm phòng mới</h3>
              <button onClick={() => setUnitModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {unitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{unitError}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Số phòng *</label>
                <input value={unitForm.room_number}
                  onChange={(e) => setUnitForm((f) => ({ ...f, room_number: e.target.value }))}
                  placeholder="VD: 101, 202A..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Tầng</label>
                <input type="number" min={1} value={unitForm.floor}
                  onChange={(e) => setUnitForm((f) => ({ ...f, floor: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-5">
              <Button variant="secondary" onClick={() => setUnitModal(false)}>Hủy</Button>
              <Button onClick={handleAddUnit} disabled={unitSaving}>
                {unitSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Thêm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
