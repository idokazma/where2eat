'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Youtube, X } from 'lucide-react';
import { FilterChip } from './FilterChip';

interface CreatorFilterProps {
  creators: string[];
  selected: string | null;
  onSelect: (creator: string | null) => void;
  /** Restaurant count per creator, shown next to each option. */
  counts?: Record<string, number>;
  /** Total restaurants for the "all sources" row. */
  totalCount?: number;
  className?: string;
}

/**
 * Source picker for the home filter bar: one button showing the current
 * selection, which opens a bottom sheet listing every source.
 * Hidden when the data only has a single source, since filtering adds nothing.
 */
export function CreatorFilter({
  creators,
  selected,
  onSelect,
  counts,
  totalCount,
  className = '',
}: CreatorFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  if (creators.length < 2) return null;

  // Largest sources first, so the main creator leads the list.
  const ordered = [...creators].sort(
    (a, b) => (counts?.[b] ?? 0) - (counts?.[a] ?? 0) || a.localeCompare(b, 'he')
  );

  const choose = (creator: string | null) => {
    onSelect(creator);
    setIsOpen(false);
  };

  const optionClass = (active: boolean) =>
    `w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border-2 text-right transition-all active:scale-[0.98] ${
      active
        ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-accent)]'
        : 'bg-[var(--color-surface)] border-transparent text-[var(--color-ink)] hover:border-[var(--color-border)]'
    }`;

  const sheet = (
    <div className="fixed inset-0 z-[1000] flex items-end" role="dialog" aria-modal="true" aria-label="בחירת מקור">
      <button
        type="button"
        aria-label="סגור"
        className="absolute inset-0 bg-black/40"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-h-[75vh] flex flex-col bg-[var(--color-paper)] rounded-t-3xl border-t-2 border-[var(--color-ink)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">בחר מקור</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 -m-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button type="button" onClick={() => choose(null)} className={optionClass(selected === null)}>
            <span className="flex items-center gap-2 text-sm font-semibold">
              {selected === null && <Check className="w-4 h-4" />}
              כל המקורות
            </span>
            {typeof totalCount === 'number' && (
              <span className="text-xs text-[var(--color-ink-muted)]">{totalCount}</span>
            )}
          </button>
          {ordered.map((creator) => {
            const isSelected = selected === creator;
            return (
              <button
                key={creator}
                type="button"
                onClick={() => choose(creator)}
                className={optionClass(isSelected)}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {isSelected ? <Check className="w-4 h-4" /> : <Youtube className="w-4 h-4" />}
                  {creator}
                </span>
                {counts && typeof counts[creator] === 'number' && (
                  <span className="text-xs text-[var(--color-ink-muted)]">{counts[creator]}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <FilterChip
        label={selected ? `מקור: ${selected}` : 'מקור'}
        icon={<Youtube className="w-4 h-4" />}
        hasDropdown
        isSelected={selected !== null}
        onClick={() => setIsOpen(true)}
        onClear={selected ? () => onSelect(null) : undefined}
        className="max-w-[60vw] [&>span:not(:first-child)]:truncate"
      />
      {isOpen && typeof document !== 'undefined' && createPortal(sheet, document.body)}
    </div>
  );
}
