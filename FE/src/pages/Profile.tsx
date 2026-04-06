import React, { useState, useEffect } from 'react';
import { Camera, Mail, Phone, Loader2, User, Shield, CalendarDays, CreditCard, BedDouble, BadgeCheck, Lock, Eye, EyeOff } from 'lucide-react';
import { ProfileSidebar } from '../components/layout/ProfileSidebar';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../lib/auth';
import { userApi, type AuthUser } from '../lib/api';
import { formatVND, formatDate } from '../lib/utils';

export const Profile: React.FC = () => {
  const { user, login, token } = useAuth();

  const [profile, setProfile]   = useState<AuthUser | null>(null);
  const [loading, setLoading]   = useState(true);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // Password change state
  const [pwCurrent, setPwCurrent]   = useState('');
  const [pwNew, setPwNew]           = useState('');
  const [pwConfirm, setPwConfirm]   = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwSaved, setPwSaved]       = useState(false);
  const [pwError, setPwError]       = useState('');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    userApi.detail(user.userId)
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name ?? '');
        setPhone(data.phone ?? '');
      })
      .catch(() => {
        // fallback về context nếu API lỗi
        setProfile(user as AuthUser);
        setFullName(user.full_name ?? '');
        setPhone(user.phone ?? '');
      })
      .finally(() => setLoading(false));
  }, [user?.userId]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Vui lòng đăng nhập để xem hồ sơ.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const p = profile ?? user;
  const initials = (p.full_name || p.username)
    .split(' ').map((w: string) => w[0]).slice(-2).join('').toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await userApi.update(user.userId, { full_name: fullName, phone });
      const updated = { ...user, full_name: fullName, phone };
      login(token!, updated);
      setProfile((prev) => prev ? { ...prev, full_name: fullName, phone } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message ?? 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwNew !== pwConfirm) { setPwError('Mật khẩu xác nhận không khớp'); return; }
    if (pwNew.length < 6)    { setPwError('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    setPwSaving(true);
    try {
      await userApi.changePassword(user.userId, pwCurrent, pwNew);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2500);
    } catch (e: any) {
      setPwError(e.message ?? 'Đổi mật khẩu thất bại');
    } finally {
      setPwSaving(false);
    }
  };

  const stats = [
    {
      icon: <BedDouble className="h-5 w-5 text-blue-500" />,
      label: 'Tổng đặt phòng',
      value: `${(p as any).total_bookings ?? 0} lần`,
      bg: 'bg-blue-50',
    },
    {
      icon: <CreditCard className="h-5 w-5 text-emerald-500" />,
      label: 'Tổng chi tiêu',
      value: formatVND((p as any).total_spent ?? 0),
      bg: 'bg-emerald-50',
    },
    {
      icon: <CalendarDays className="h-5 w-5 text-violet-500" />,
      label: 'Thành viên từ',
      value: (p as any).created_at ? formatDate((p as any).created_at) : '—',
      bg: 'bg-violet-50',
    },
    {
      icon: <Shield className="h-5 w-5 text-orange-500" />,
      label: 'Vai trò',
      value: user.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-60 shrink-0">
            <ProfileSidebar />
          </div>

          <div className="flex-1 min-w-0 space-y-6">

            {/* Hero card */}
            <Card>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                    {initials}
                  </div>
                  <button
                    type="button"
                    aria-label="Thay đổi ảnh đại diện"
                    className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <Camera className="h-3.5 w-3.5 text-gray-600" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900">{p.full_name || p.username}</h1>
                    {user.role === 'ADMIN' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                        <BadgeCheck className="h-3.5 w-3.5" /> Admin
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-1">@{p.username}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{p.email}</span>
                    {p.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{p.phone}</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s) => (
                <div key={s.label} className={`${s.bg} rounded-2xl p-4 flex flex-col gap-2`}>
                  <div className="flex items-center gap-2">
                    {s.icon}
                    <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                  </div>
                  <p className="text-base font-bold text-gray-900 leading-tight">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Edit form */}
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <User className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-bold text-gray-900">Chỉnh sửa thông tin</h2>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-5 max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input
                    label="Họ và tên"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nhập họ và tên..."
                  />
                  <Input
                    label="Số điện thoại"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    icon={<Phone className="h-4 w-4" />}
                    placeholder="VD: 0901234567"
                  />
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={p.email}
                  disabled
                  icon={<Mail className="h-4 w-4" />}
                />

                <Input
                  label="Tên đăng nhập"
                  type="text"
                  value={p.username}
                  disabled
                  icon={<User className="h-4 w-4" />}
                />

                <div className="flex items-center gap-4 pt-1">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Lưu thay đổi
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      <BadgeCheck className="h-4 w-4" /> Đã lưu thành công!
                    </span>
                  )}
                </div>
              </form>
            </Card>

            {/* Change password */}
            <Card>
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-bold text-gray-900">Đổi mật khẩu</h2>
              </div>

              {pwError && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">
                  {pwError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-5 max-w-xl">
                {/* Current password */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={pwCurrent}
                      onChange={(e) => setPwCurrent(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại..."
                      required
                      className="w-full border border-gray-300 rounded-xl py-3 px-4 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      placeholder="Ít nhất 6 ký tự..."
                      required
                      className="w-full border border-gray-300 rounded-xl py-3 px-4 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {pwNew.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                          pwNew.length >= i * 3
                            ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-yellow-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-500'
                            : 'bg-gray-200'
                        }`} />
                      ))}
                      <span className="text-xs text-gray-400 ml-1">
                        {pwNew.length < 4 ? 'Yếu' : pwNew.length < 7 ? 'Trung bình' : pwNew.length < 10 ? 'Khá' : 'Mạnh'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={pwConfirm}
                      onChange={(e) => setPwConfirm(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới..."
                      required
                      className={`w-full border rounded-xl py-3 px-4 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent ${
                        pwConfirm && pwNew !== pwConfirm
                          ? 'border-red-400 focus:ring-red-400'
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {pwConfirm && pwNew !== pwConfirm && (
                    <p className="mt-1 text-xs text-red-500">Mật khẩu xác nhận không khớp</p>
                  )}
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <Button type="submit" disabled={pwSaving}>
                    {pwSaving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Đổi mật khẩu
                  </Button>
                  {pwSaved && (
                    <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                      <BadgeCheck className="h-4 w-4" /> Đổi mật khẩu thành công!
                    </span>
                  )}
                </div>
              </form>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
};
