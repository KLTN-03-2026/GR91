/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { ScrollToTop } from './components/layout/ScrollToTop';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Home } from './pages/Home';
import { RoomList } from './pages/RoomList';
import { RoomDetail } from './pages/RoomDetail';
import { PhysicalRoomDetail } from './pages/PhysicalRoomDetail';
import { Checkout } from './pages/Checkout';
import { Profile } from './pages/Profile';
import { BookingHistory } from './pages/BookingHistory';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminLayout } from './pages/admin/AdminLayout';
import { Dashboard } from './pages/admin/Dashboard';
import { AdminBookings } from './pages/admin/AdminBookings';
import { AdminRooms } from './pages/admin/AdminRooms';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminRoomTypes } from './pages/admin/AdminRoomTypes';
import { AdminRoomUnit } from './pages/admin/AdminRoomUnit';
import { AdminRoomUnits } from './pages/admin/AdminRoomUnits';
import { AdminReviews } from './pages/admin/AdminReviews';
import { AdminInvoices } from './pages/admin/AdminInvoices';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VNPayReturn } from './pages/VNPayReturn';
import { About } from './pages/About';
import { Services } from './pages/Services';
import { Contact } from './pages/Contact';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <Router>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/rooms" element={<RoomList/>} />
            <Route path="/rooms/:id" element={<RoomDetail />} />
            <Route path="/room/:room_id" element={<PhysicalRoomDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/history" element={<BookingHistory />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="rooms" element={<AdminRooms />} />
              <Route path="rooms/:typeId" element={<AdminRoomTypes />} />
              <Route path="rooms/:typeId/units/:roomId" element={<AdminRoomUnit />} />
              <Route path="room-units" element={<AdminRoomUnits />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="settings" element={<AdminSettings />} />
           </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/payment/vnpay-return" element={<VNPayReturn />} />
          </Routes>
        </main>
        <Footer />
      </div>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
