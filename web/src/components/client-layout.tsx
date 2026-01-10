'use client';

import { useEffect } from 'react';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { language, dir } = useLanguage();

  useEffect(() => {
    // Update html attributes when language changes
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LayoutContent>{children}</LayoutContent>
    </LanguageProvider>
  );
}
