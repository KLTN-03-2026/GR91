import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const AdminSettings: React.FC = () => {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900">Cài đặt hệ thống</h1>
        <p className="text-sm text-gray-500">Quản lý thông tin và cấu hình khách sạn.</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <h2 className="font-semibold text-gray-900 mb-5">Thông tin khách sạn</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="Tên khách sạn" defaultValue="SmartHotel" />
            <Input label="Email liên hệ" type="email" defaultValue="info@smarthotel.vn" />
            <Input label="Số điện thoại" type="tel" defaultValue="+84 123 456 789" />
            <Input label="Địa chỉ" defaultValue="123 Đường ABC, Quận 1, TP.HCM" />
            <div className="flex items-center gap-4 pt-2">
              <Button type="submit">Lưu thay đổi</Button>
              {saved && <span className="text-sm text-green-600 font-medium">Đã lưu thành công!</span>}
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold text-gray-900 mb-5">Chính sách đặt phòng</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Giờ nhận phòng</p>
                <p className="text-xs text-gray-500">Thời gian check-in mặc định</p>
              </div>
              <input type="time" defaultValue="14:00" className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Giờ trả phòng</p>
                <p className="text-xs text-gray-500">Thời gian check-out mặc định</p>
              </div>
              <input type="time" defaultValue="12:00" className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Hủy miễn phí</p>
                <p className="text-xs text-gray-500">Số giờ trước nhận phòng</p>
              </div>
              <input type="number" defaultValue={48} min={0} className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 text-center" />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};
