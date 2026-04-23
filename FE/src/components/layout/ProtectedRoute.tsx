import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { authApi } from '../../lib/api';
import { redirectToLogin } from '../../lib/redirectToLogin';
import { useToast } from '../ui/Toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin }) => {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    if (!token) {
      redirectToLogin(navigate, location);
      return;
    }

    authApi.me()
      .then((meData) => {
        if (requireAdmin && meData.role !== 'ADMIN') {
          addToast({ title: 'Truy cập bị từ chối', message: 'Bạn không có quyền truy cập trang quản trị', type: 'error' });
          navigate('/');
        } else {
          setIsVerifying(false);
        }
      })
      .catch((err) => {
        console.error('Lỗi xác thực token:', err);
        logout();
        redirectToLogin(navigate, location, { message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });
      });
  }, [token, navigate, location, logout, requireAdmin, addToast]);

  if (!token || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
};
