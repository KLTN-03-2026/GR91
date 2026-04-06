import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, History, Heart, Settings, LogOut, LayoutDashboard } from 'lucide-react';
import { Card } from '../ui/Card';
import { useAuth } from '../../lib/auth';

const USER_NAV = [
  { label: 'Hồ sơ cá nhân',     path: '/profile',   icon: User },
  { label: 'Lịch sử đặt phòng', path: '/history',   icon: History },
  { label: 'Phòng yêu thích',   path: '/favorites', icon: Heart },
  { label: 'Cài đặt tài khoản', path: '/settings',  icon: Settings },
];

const ADMIN_NAV = [
  { label: 'Trang quản trị', path: '/admin', icon: LayoutDashboard },
  { label: 'Cài đặt tài khoản', path: '/settings', icon: Settings },
];

export const ProfileSidebar: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()
    : '?';

  const navItems = isAdmin ? ADMIN_NAV : USER_NAV;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Card padding={false} className="overflow-hidden">
      {/* Avatar */}
      <div className="p-6 border-b border-gray-100 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl mb-3">
          {initials}
        </div>
        <p className="font-semibold text-gray-900">{user?.full_name ?? 'Người dùng'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
        {isAdmin && (
          <span className="mt-2 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
            Quản trị viên
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="p-3 space-y-0.5">
        {navItems.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === path
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors mt-2"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </nav>
    </Card>
  );
};
