'use client';

import { MapPin } from 'lucide-react';
import { PageLayout } from '@/components/layout';

export default function MapPage() {
  return (
    <PageLayout title="מפה" showHeader showBottomNav>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
          <MapPin className="w-10 h-10 text-[var(--color-ink-muted)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">
          מפה בקרוב
        </h2>
        <p className="text-[var(--color-ink-muted)] max-w-xs">
          תצוגת מפה אינטראקטיבית עם כל המסעדות תהיה זמינה בקרוב
        </p>
      </div>
    </PageLayout>
  );
}
