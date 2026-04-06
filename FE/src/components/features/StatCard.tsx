import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/Card';

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  iconBg: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, trendUp, icon, iconBg }) => (
  <Card>
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
      {trend && (
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${trendUp ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend}
        </span>
      )}
    </div>
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
  </Card>
);
