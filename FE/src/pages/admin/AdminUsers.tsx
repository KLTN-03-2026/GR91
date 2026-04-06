import React, { useState, useEffect, useCallback } from 'react';
import { Search, MoreVertical, Loader2, Mail, Phone, Calendar, Edit2, Trash2, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { DateRangeFilter } from '../../components/admin/DateRangeFilter';
import { userApi, type AuthUser, type ListQuery } from '../../lib/api';
import { formatVND, formatDate } from '../../lib/utils';

export const AdminUsers: React.FC = () => {
  const [users, setUsers]     = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState<ListQuery>({});
  
  // Edit State
  const [editing, setEditing]   = useState<AuthUser | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userApi.list(query);
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khách hàng này? Thao tác này không thể hoàn tác.')) return;
    try {
      await userApi.remove(id);
      setUsers(users.filter(u => u.userId !== id));
    } catch (e: any) {
      alert(e.message || 'Xóa thất bại');
    }
  };

  const startEdit = (u: AuthUser) => {
    setEditing(u);
    setEditForm({ full_name: u.full_name || '', phone: u.phone || '' });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await userApi.update(editing.userId, editForm);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e.message || 'Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = users.filter((u) =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Khách hàng</h1>
          <p className="text-sm text-gray-500">Quản lý và theo dõi danh sách thành viên.</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter onFilter={(start, end) => setQuery({ start_date: start, end_date: end })} />
        </div>
      </div>

      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/10">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-gray-400 font-medium flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-xs uppercase tracking-widest text-gray-300">Đang tải khách hàng...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider font-bold">
                  {['Khách hàng', 'Liên hệ', 'Đặt phòng', 'Tổng chi tiêu', 'Ngày tham gia', 'Thao tác'].map((h) => (
                    <th key={h} className="px-5 py-3 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length > 0 ? filtered.map((u) => (
                  <tr key={u.userId} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                          {(u.full_name || u.username).split(' ').map((n) => n[0]).slice(-2).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{u.full_name || u.username}</p>
                          <p className="text-xs text-gray-400">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center text-sm text-gray-700 mb-1">
                        <Mail className="h-3.5 w-3.5 mr-1.5 text-gray-400" /> {u.email}
                      </div>
                      {u.phone && (
                        <div className="flex items-center text-xs text-gray-500 font-medium">
                          <Phone className="h-3.5 w-3.5 mr-1.5 text-gray-400" /> {u.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="blue" className="px-3 py-1 font-bold text-xs">{u.total_bookings ?? 0} lần</Badge>
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-gray-900">
                      {formatVND(u.total_spent ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {u.created_at ? formatDate(u.created_at) : 'N/A'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(u.userId)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400 font-medium">
                      Không tìm thấy khách hàng nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Chỉnh sửa thông tin</h3>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Họ tên</label>
                <input 
                  type="text" 
                  value={editForm.full_name}
                  onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Số điện thoại</label>
                <input 
                  type="text" 
                  value={editForm.phone}
                  onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1 rounded-2xl" onClick={() => setEditing(null)}>Hủy</Button>
                <Button className="flex-1 rounded-2xl" type="submit" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
