import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BedDouble, DoorOpen, Users, CalendarCheck, Settings, LogOut, Building2, Star, FileText } from 'lucide-react';
import { useAuth } from '../../lib/auth';

const NAV_ITEMS = [
  { label: 'Dashboard',     path: '/admin',           icon: LayoutDashboard },
  { label: 'Loại phòng',    path: '/admin/rooms',      icon: BedDouble       },
  { label: 'Quản lý phòng', path: '/admin/room-units', icon: DoorOpen        },
  { label: 'Khách hàng',    path: '/admin/users',      icon: Users           },
  { label: 'Đặt phòng',     path: '/admin/bookings',   icon: CalendarCheck   },
  { label: 'Hóa đơn',       path: '/admin/invoices',   icon: FileText        },
  { label: 'Đánh giá',      path: '/admin/reviews',    icon: Star            },
  { label: 'Cài đặt',       path: '/admin/settings',   icon: Settings        },
];

export const AdminSidebar: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-800 shrink-0">
        <Link to="/" className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors">
          <Building2 className="h-7 w-7 text-blue-400" />
          <span className="font-bold text-base tracking-wider">SMARTHOTEL</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = pathname === path || (path !== '/admin' && pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-800 shrink-0 space-y-1">
        {user && (
          <div className="px-3 py-2 text-xs text-gray-500 truncate">{user.email}</div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
};
