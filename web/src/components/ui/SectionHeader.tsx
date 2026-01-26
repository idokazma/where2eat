'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  action,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`section-header ${className}`}>
      <h2 className="section-title">
        {icon}
        <span>{title}</span>
      </h2>

      {action && (
        action.href ? (
          <Link href={action.href} className="section-action flex items-center gap-1">
            <span>{action.label}</span>
            <ChevronLeft className="w-4 h-4" />
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="section-action flex items-center gap-1"
          >
            <span>{action.label}</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        )
      )}
    </div>
  );
}
