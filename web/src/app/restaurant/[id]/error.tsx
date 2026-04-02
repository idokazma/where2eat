'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

export default function RestaurantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Restaurant page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-col items-center justify-center px-4" dir="rtl">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-ink)] mb-2">
          שגיאה בטעינת המסעדה
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)] mb-6">
          אירעה שגיאה בעת טעינת דף המסעדה. נסה שוב או חזור לדף הראשי.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-[var(--color-accent)] text-white rounded-xl font-medium text-sm"
          >
            נסה שוב
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-[var(--color-surface)] text-[var(--color-ink)] rounded-xl font-medium text-sm border border-[var(--color-border)]"
          >
            חזרה לדף הראשי
          </button>
        </div>
      </div>
    </div>
  );
}
