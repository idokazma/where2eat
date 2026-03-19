'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VideosPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/pipeline?tab=all-videos');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-muted-foreground">Redirecting to Pipeline...</p>
    </div>
  );
}
