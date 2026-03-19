'use client';

import { Providers } from '@/components/admin/providers';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div dir="ltr" lang="en" className="min-h-screen bg-background text-foreground antialiased">
      <Providers>
        {children}
      </Providers>
    </div>
  );
}
