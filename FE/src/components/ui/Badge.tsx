import React from 'react';
import { cn } from '../../lib/utils';
import type { BookingStatus } from '../../types';

type BadgeVariant = 'blue' | 'green' | 'yellow' | 'red' | 'gray';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'gray', children, className }) => (
  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', variantClasses[variant], className)}>
    {children}
  </span>
);

// Convenience: booking status badge
const statusMap: Record<BookingStatus, { variant: BadgeVariant; label: string }> = {
  confirmed:      { variant: 'green',  label: 'Đã xác nhận' },
  pending:        { variant: 'yellow', label: 'Chờ xử lý' },
  completed:      { variant: 'blue',   label: 'Hoàn thành' },
  cancelled:      { variant: 'red',    label: 'Đã hủy' },
  partially_paid: { variant: 'yellow', label: 'Thanh toán một phần' },
  checked_in:     { variant: 'green',  label: 'Đã nhận phòng' },
};

export const StatusBadge: React.FC<{ status: BookingStatus }> = ({ status }) => {
  const info = statusMap[status] ?? { variant: 'gray' as BadgeVariant, label: status };
  return <Badge variant={info.variant}>{info.label}</Badge>;
};
