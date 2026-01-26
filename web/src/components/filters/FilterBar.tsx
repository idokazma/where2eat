'use client';

import { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div className={`filter-bar ${className}`}>
      {children}
    </div>
  );
}
