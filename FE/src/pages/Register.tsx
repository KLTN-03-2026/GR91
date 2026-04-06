import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, User, Phone, AtSign } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuth } from '../lib/auth';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', full_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await authApi.register(form);
      login(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, type: string, placeholder: string, icon: React.ReactNode, autoComplete?: string) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1 relative rounded-md shadow-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          {icon}
        </div>
        <input
          id={id}
          name={id}
          type={type}
          required
          autoComplete={autoComplete}
          value={(form as any)[id]}
          onChange={set(id)}
          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-xl py-3 border outline-none"
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link to="/" className="flex items-center gap-2">
            <Building2 className="h-10 w-10 text-blue-800" />
            <span className="font-bold text-3xl text-blue-900 tracking-wider">SMARTHOTEL</span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Tạo tài khoản mới</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Đăng nhập ngay</Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {field('full_name', 'Họ và tên', 'text', 'Nguyễn Văn A', <User className="h-5 w-5" />)}
            {field('username', 'Tên đăng nhập', 'text', 'nguyenvana', <AtSign className="h-5 w-5" />)}
            {field('email', 'Địa chỉ Email', 'email', 'you@example.com', <Mail className="h-5 w-5" />, 'email')}
            {field('phone', 'Số điện thoại', 'tel', '+84 123 456 789', <Phone className="h-5 w-5" />)}
            {field('password', 'Mật khẩu', 'password', '••••••••', <Lock className="h-5 w-5" />, 'new-password')}

            <div className="flex items-center">
              <input id="terms" type="checkbox" required className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                Tôi đồng ý với{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">Điều khoản dịch vụ</a>
                {' '}và{' '}
                <a href="#" className="text-blue-600 hover:text-blue-500">Chính sách bảo mật</a>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-60"
            >
              {loading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
