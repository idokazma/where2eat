'use client';

import { ChevronDown, X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  isSelected?: boolean;
  hasDropdown?: boolean;
  onClear?: () => void;
  onClick?: () => void;
  className?: string;
}

export function FilterChip({
  label,
  icon,
  isActive = false,
  isSelected = false,
  hasDropdown = false,
  onClear,
  onClick,
  className = '',
}: FilterChipProps) {
  const stateClass = isActive ? 'active' : isSelected ? 'selected' : '';

  return (
    <button
      onClick={onClick}
      className={`filter-chip ${stateClass} ${className}`}
      type="button"
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>

      {isSelected && onClear ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }
          }}
          className="flex-shrink-0 -mr-1 p-0.5 rounded-full hover:bg-[var(--color-accent)] hover:text-white transition-colors cursor-pointer"
          aria-label="Clear filter"
        >
          <X className="w-3.5 h-3.5" />
        </span>
      ) : hasDropdown ? (
        <ChevronDown className="w-4 h-4 flex-shrink-0 -mr-1" />
      ) : null}
    </button>
  );
}
