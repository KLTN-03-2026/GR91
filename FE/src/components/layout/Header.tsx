import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Menu, X, User, LogOut, LayoutDashboard, History } from 'lucide-react';
import { NAV_LINKS } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (location.pathname.startsWith('/admin')) return null;

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()
    : '?';

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Building2 className="h-7 w-7 text-blue-700" />
            <span className="font-bold text-lg text-blue-900 tracking-wider">SMARTHOTEL</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === path
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                    {user.full_name}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Đăng nhập với</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
                    </div>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <LayoutDashboard className="h-4 w-4" /> Quản trị
                      </Link>
                    )}
                    {!isAdmin && (
                      <>
                        <Link
                          to="/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <User className="h-4 w-4" /> Hồ sơ
                        </Link>
                        <Link
                          to="/history"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          <History className="h-4 w-4" /> Lịch sử đặt phòng
                        </Link>
                      </>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Đăng nhập
                </Link>
                <Link to="/register" className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors">
                  Đăng ký
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === path ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            {user ? (
              <>
                <div className="px-4 py-2 text-sm text-gray-700 font-medium">{user.full_name}</div>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                    Quản trị
                  </Link>
                )}
                {!isAdmin && (
                  <>
                    <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                      Hồ sơ
                    </Link>
                    <Link to="/history" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                      Lịch sử đặt phòng
                    </Link>
                  </>
                )}
                <button onClick={handleLogout} className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                  Đăng nhập
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg text-center">
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
