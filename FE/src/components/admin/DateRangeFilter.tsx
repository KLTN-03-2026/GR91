import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { Button } from '../ui/Button';

export type DatePeriod = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface DateRangeFilterProps {
  onFilter: (start: string | undefined, end: string | undefined) => void;
  className?: string;
}

const PERIODS: { label: string; value: DatePeriod }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Hôm nay', value: 'today' },
  { label: 'Tuần này', value: 'week' },
  { label: 'Tháng này', value: 'month' },
  { label: 'Quý này', value: 'quarter' },
  { label: 'Năm nay', value: 'year' },
  { label: 'Khoảng tùy chỉnh', value: 'custom' },
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onFilter, className }) => {
  const [period, setPeriod] = useState<DatePeriod>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const calculateRange = (p: DatePeriod) => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined = new Date(); // Today

    switch (p) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        const day = now.getDay() || 7; // Sunday is 7
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(now.getDate() - day + 1); // Monday
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        start = undefined;
        end = undefined;
        break;
      case 'custom':
        return null; // Handle elsewhere
    }

    return { 
      start: start?.toISOString().split('T')[0], 
      end: end?.toISOString().split('T')[0] 
    };
  };

  const handlePeriodSelect = (p: DatePeriod) => {
    setPeriod(p);
    if (p !== 'custom') {
      const range = calculateRange(p);
      onFilter(range?.start, range?.end);
      setIsOpen(false);
    }
  };

  const handleCustomApply = () => {
    if (customRange.start && customRange.end) {
      onFilter(customRange.start, customRange.end);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm"
      >
        <Calendar className="h-4 w-4 text-blue-500" />
        <span>{PERIODS.find(p => p.value === period)?.label}</span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-50 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodSelect(p.value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  period === p.value ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
                {period === p.value && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="mt-3 pt-3 border-t border-gray-100 p-2 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Từ ngày</label>
                <input 
                  type="date" 
                  value={customRange.start}
                  onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Đến ngày</label>
                <input 
                  type="date" 
                  value={customRange.end}
                  onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <Button size="sm" className="w-full" onClick={handleCustomApply} disabled={!customRange.start || !customRange.end}>
                Áp dụng
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
