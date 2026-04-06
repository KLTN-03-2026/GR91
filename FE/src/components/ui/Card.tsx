import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, padding = true }) => (
  <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm', padding && 'p-6', className)}>
    {children}
  </div>
);
