'use client';

import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
  showBottomNav?: boolean;
  showSearch?: boolean;
  showSettings?: boolean;
  onSearchClick?: () => void;
  headerRightContent?: React.ReactNode;
  className?: string;
}

export function PageLayout({
  children,
  title,
  showHeader = true,
  showBottomNav = true,
  showSearch = true,
  showSettings = true,
  onSearchClick,
  headerRightContent,
  className = '',
}: PageLayoutProps) {
  return (
    <div className={`page-container ${className}`}>
      {showHeader && (
        <Header
          title={title}
          showSearch={showSearch}
          showSettings={showSettings}
          onSearchClick={onSearchClick}
          rightContent={headerRightContent}
        />
      )}

      <main className="page-content">
        {children}
      </main>

      {showBottomNav && <BottomNav />}
    </div>
  );
}
