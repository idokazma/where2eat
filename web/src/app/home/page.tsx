'use client';

import { Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import { HomePageNew } from '@/components/HomePageNew';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)]">
      <div className="text-center animate-fade-up">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-accent-subtle)] flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
        <p className="text-lg font-medium text-[var(--color-ink)]">טוען...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomePageNew />
    </Suspense>
  );
}
