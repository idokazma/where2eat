'use client';

import { Search, Settings } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showSettings?: boolean;
  onSearchClick?: () => void;
  rightContent?: React.ReactNode;
}

export function Header({
  title = 'Where2Eat',
  showSearch = true,
  showSettings = true,
  onSearchClick,
  rightContent,
}: HeaderProps) {
  return (
    <header className="header">
      <Link href="/" className="header-title">
        {title}
      </Link>

      <div className="flex items-center gap-2">
        {rightContent}

        {showSearch && (
          <button
            onClick={onSearchClick}
            className="p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </button>
        )}

        {showSettings && (
          <Link
            href="/settings"
            className="p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </Link>
        )}
      </div>
    </header>
  );
}
