import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Phone, Mail, MapPin } from 'lucide-react';

const QUICK_LINKS = [
  { label: 'Trang chủ', path: '/' },
  { label: 'Phòng nghỉ', path: '/rooms' },
  { label: 'Dịch vụ', path: '/services' },
  { label: 'Ưu đãi', path: '/offers' },
];

const SUPPORT_LINKS = [
  { label: 'Liên hệ', path: '/contact' },
  { label: 'Câu hỏi thường gặp', path: '/faq' },
  { label: 'Chính sách bảo mật', path: '/privacy' },
  { label: 'Điều khoản dịch vụ', path: '/terms' },
];

export const Footer: React.FC = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <footer className="bg-white border-t border-gray-100 pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Building2 className="h-7 w-7 text-blue-700" />
              <span className="font-bold text-lg text-blue-900 tracking-wider">SMARTHOTEL</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Khám phá sự sang trọng và thoải mái bậc nhất tại hệ thống khách sạn hàng đầu Việt Nam.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Liên kết nhanh</h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map(({ label, path }) => (
                <li key={path}>
                  <Link to={path} className="text-sm text-gray-500 hover:text-blue-600 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Hỗ trợ</h3>
            <ul className="space-y-3">
              {SUPPORT_LINKS.map(({ label, path }) => (
                <li key={path}>
                  <Link to={path} className="text-sm text-gray-500 hover:text-blue-600 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Liên hệ</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-gray-500">
                <Phone className="h-4 w-4 shrink-0" />
                +84 123 456 789
              </li>
              <li className="flex items-center gap-2.5 text-sm text-gray-500">
                <Mail className="h-4 w-4 shrink-0" />
                info@smarthotel.vn
              </li>
              <li className="flex items-start gap-2.5 text-sm text-gray-500">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                123 Đường ABC, Quận 1, TP.HCM
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          © 2024 SmartHotel. Tất cả quyền được bảo lưu.
        </div>
      </div>
    </footer>
  );
};
