'use client';

import { Youtube } from 'lucide-react';
import { FilterChip } from './FilterChip';

interface CreatorFilterProps {
  creators: string[];
  selected: string | null;
  onSelect: (creator: string | null) => void;
  className?: string;
}

/**
 * Creator/channel chips for the home filter bar.
 * Hidden when the data only has a single creator — filtering adds nothing then.
 */
export function CreatorFilter({ creators, selected, onSelect, className = '' }: CreatorFilterProps) {
  if (creators.length < 2) return null;

  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
      {creators.map((creator) => {
        const isSelected = selected === creator;
        return (
          <FilterChip
            key={creator}
            label={creator}
            icon={<Youtube className="w-4 h-4" />}
            isSelected={isSelected}
            onClick={() => onSelect(isSelected ? null : creator)}
            onClear={isSelected ? () => onSelect(null) : undefined}
          />
        );
      })}
    </div>
  );
}
