'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { useSiteSettings } from '@/lib/site-settings';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { language, dir } = useLanguage();
  const pathname = usePathname();
  const { settings, loaded } = useSiteSettings();

  useEffect(() => {
    // Update html attributes when language changes
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  // Maintenance mode (admin Site Content): visitors see a holding page.
  // Never blocks /admin so admins can always turn it back off.
  if (
    loaded &&
    settings['site.maintenance_mode'] === 'true' &&
    !pathname.startsWith('/admin')
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-2">חוזרים בקרוב</h1>
          <p className="text-[var(--color-ink-muted)]">האתר בתחזוקה קצרה. תודה על הסבלנות.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LayoutContent>{children}</LayoutContent>
    </LanguageProvider>
  );
}
