'use client';

import Link from 'next/link';
import { Settings, Info, Shield, Mail, ExternalLink, ChevronLeft } from 'lucide-react';
import { PageLayout } from '@/components/layout';

const menuItems = [
  {
    icon: Settings,
    label: 'הגדרות',
    href: '/settings',
  },
  {
    icon: Info,
    label: 'אודות',
    href: '/about',
  },
  {
    icon: Shield,
    label: 'פרטיות',
    href: '/privacy',
  },
  {
    icon: Mail,
    label: 'צור קשר',
    href: 'mailto:hello@where2eat.co.il',
    external: true,
  },
];

export default function MorePage() {
  return (
    <PageLayout title="עוד" showHeader showBottomNav showSettings={false}>
      <div className="py-4">
        <nav className="space-y-1 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon;

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-[var(--color-ink-muted)]" />
                    <span className="text-[var(--color-ink)]">{item.label}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[var(--color-ink-subtle)]" />
                </a>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-[var(--color-ink-muted)]" />
                  <span className="text-[var(--color-ink)]">{item.label}</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-[var(--color-ink-subtle)]" />
              </Link>
            );
          })}
        </nav>

        {/* Admin link */}
        <div className="mt-8 px-4">
          <Link
            href="/admin"
            className="block p-4 rounded-lg bg-[var(--color-surface)] text-center text-sm text-[var(--color-ink-muted)]"
          >
            ניהול (Admin)
          </Link>
        </div>

        {/* Version */}
        <div className="mt-8 text-center">
          <p className="text-xs text-[var(--color-ink-subtle)]">
            Where2Eat v2.0
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
