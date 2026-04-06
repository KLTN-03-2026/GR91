import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Search } from 'lucide-react';

export const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2 Khách, 1 Phòng');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/rooms');
  };

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white rounded-2xl shadow-2xl p-2 flex flex-col md:flex-row gap-2 items-stretch max-w-3xl mx-auto"
    >
      {/* Check-in */}
      <label className="flex-1 flex items-center gap-3 px-4 py-2.5 md:border-r border-gray-100 cursor-pointer">
        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium">Nhận phòng</p>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="w-full text-sm font-medium text-gray-700 bg-transparent outline-none"
          />
        </div>
      </label>

      {/* Check-out */}
      <label className="flex-1 flex items-center gap-3 px-4 py-2.5 md:border-r border-gray-100 cursor-pointer">
        <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium">Trả phòng</p>
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full text-sm font-medium text-gray-700 bg-transparent outline-none"
          />
        </div>
      </label>

      {/* Guests */}
      <label className="flex-1 flex items-center gap-3 px-4 py-2.5 cursor-pointer">
        <Users className="h-4 w-4 text-gray-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-gray-400 font-medium">Số khách</p>
          <select
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="w-full text-sm font-medium text-gray-700 bg-transparent outline-none"
          >
            {['1 Khách, 1 Phòng', '2 Khách, 1 Phòng', '3 Khách, 1 Phòng', '4 Khách, 2 Phòng'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </label>

      <button
        type="submit"
        className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-colors shrink-0"
      >
        <Search className="h-4 w-4" />
        Tìm kiếm
      </button>
    </form>
  );
};
