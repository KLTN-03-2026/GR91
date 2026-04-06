import React from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../../components/layout/AdminSidebar';

export const AdminLayout: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex">
    <AdminSidebar />
    <main className="flex-1 ml-64 p-8 min-w-0">
      <Outlet />
    </main>
  </div>
);
