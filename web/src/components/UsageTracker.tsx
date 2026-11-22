'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackPageView, trackSessionStart } from '@/lib/usage-tracker'

/**
 * Mounts once in the root layout. Fires session_start on the first mount
 * (carries external referrer domain) and page_view on every route change.
 */
export function UsageTracker() {
  const pathname = usePathname()
  const started = useRef(false)
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    // Never track admin/test traffic - admin pages are not public usage
    if (pathname.startsWith('/admin')) {
      lastPath.current = pathname
      return
    }
    if (!started.current) {
      started.current = true
      trackSessionStart()
    }
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      trackPageView(pathname)
    }
  }, [pathname])

  return null
}
