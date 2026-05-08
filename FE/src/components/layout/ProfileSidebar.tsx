import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  History,
  Settings,
  LogOut,
  LayoutDashboard,
  LucideIcon,
} from "lucide-react";
import { Card } from "../ui/Card";
import { useAuth } from "../../lib/auth";

// 1. Định nghĩa interface rõ ràng
interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const USER_NAV: NavItem[] = [
  { label: "Hồ sơ cá nhân", path: "/profile", icon: User },
  { label: "Lịch sử đặt phòng", path: "/history", icon: History },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Trang quản trị", path: "/admin", icon: LayoutDashboard },
  { label: "Cài đặt tài khoản", path: "/settings", icon: Settings },
];

export const ProfileSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  // Đảm bảo lấy đúng giá trị boolean
  const admin = isAdmin;

  const initials =
    user?.full_name
      ?.split(" ")
      .filter((w) => w.length > 0)
      .map((word: string) => word[0])
      .slice(-2)
      .join("")
      .toUpperCase() ?? "?";

  const navItems = admin ? ADMIN_NAV : USER_NAV;

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="border-b border-gray-100 p-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
          {initials}
        </div>
        <p className="font-semibold text-gray-900">
          {user?.full_name || "Người dùng"}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {user?.email || "Không có email"}
        </p>
        {admin && (
          <span className="mt-2 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Quản trị viên
          </span>
        )}
      </div>

      <nav className="space-y-1 p-3">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>Đăng xuất</span>
        </button>
      </nav>
    </Card>
  );
};
