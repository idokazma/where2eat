'use client'

/**
 * Privacy-minimal usage tracking.
 *
 * What we collect: event type, site-relative path (no query string),
 * restaurant id, feature name, outbound target, referrer domain on first
 * hit, coarse device class, and a random per-tab session id.
 *
 * What we never collect: IP addresses, cookies, fingerprints, user agents,
 * free text (including search terms), or any identity beyond the tab.
 *
 * Events are batched (max 20) and flushed with navigator.sendBeacon so they
 * survive page unload. All failures are swallowed - analytics must never
 * break the app.
 */

import { getApiUrl } from './config'

export type UsageEventType =
  | 'page_view'
  | 'session_start'
  | 'restaurant_view'
  | 'outbound_click'
  | 'feature_use'

export type UsageFeature =
  | 'map_open'
  | 'stories_open'
  | 'story_play'
  | 'favorite_toggle'
  | 'near_me_toggle'
  | 'creator_filter'
  | 'search_run'
  | 'layout_toggle'
  | 'language_toggle'
  | 'saved_page_open'
  | 'instagram_preview'

export type OutboundTarget =
  | 'youtube'
  | 'instagram'
  | 'navigation'
  | 'website'
  | 'order'
  | 'google_maps'

export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown'

export interface UsageEvent {
  event_type: UsageEventType
  ts?: string
  path?: string
  page_type?: string
  restaurant_id?: string
  feature?: UsageFeature
  target?: OutboundTarget
  referrer_domain?: string | null
  device_class?: DeviceClass
  session_id: string
}

const BATCH_LIMIT = 10
const FLUSH_INTERVAL_MS = 5000
const SESSION_KEY = 'w2e_sid'

let queue: UsageEvent[] = []
let sessionId: string | null = null
let flushTimer: ReturnType<typeof setInterval> | null = null

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

export function getSessionId(): string {
  if (sessionId) return sessionId
  if (!isBrowser()) return 'ssr-unknown'
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY)
    if (stored && /^[A-Za-z0-9-]{8,64}$/.test(stored)) {
      sessionId = stored
      return stored
    }
  } catch {
    // sessionStorage unavailable (private mode etc.) - fall through
  }
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  try {
    window.sessionStorage.setItem(SESSION_KEY, id)
  } catch {
    // ignore
  }
  sessionId = id
  return id
}

export function getDeviceClass(): DeviceClass {
  if (!isBrowser()) return 'unknown'
  const width = window.innerWidth
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function getPageType(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/map')) return 'map'
  if (pathname.startsWith('/stories')) return 'stories'
  if (pathname.startsWith('/restaurant/')) return 'restaurant'
  if (pathname.startsWith('/episode/')) return 'episode'
  if (pathname.startsWith('/saved')) return 'saved'
  if (pathname.startsWith('/trending')) return 'trending'
  if (pathname.startsWith('/about')) return 'about'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'other'
}

function getExternalReferrerDomain(): string | null {
  if (!isBrowser() || !document.referrer) return null
  try {
    const url = new URL(document.referrer)
    if (url.hostname === window.location.hostname) return null
    return url.hostname
  } catch {
    return null
  }
}

function stripQuery(pathname: string): string {
  const q = pathname.indexOf('?')
  return q === -1 ? pathname : pathname.slice(0, q)
}

export function enqueue(event: Omit<UsageEvent, 'session_id' | 'ts'>): void {
  if (!isBrowser()) return
  queue.push({
    ...event,
    session_id: getSessionId(),
    ts: new Date().toISOString(),
  })
  if (queue.length >= BATCH_LIMIT) {
    flush()
  } else {
    scheduleFlush()
  }
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setInterval(() => {
    if (queue.length > 0) flush()
  }, FLUSH_INTERVAL_MS)
}

export function flush(): void {
  if (!isBrowser() || queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  const body = JSON.stringify({ events: batch.slice(0, 20) })
  const url = getApiUrl('/api/usage/event')
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(url, blob)) return
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // analytics must never break the app
  }
}

let lifecycleBound = false

function bindLifecycle(): void {
  if (lifecycleBound || !isBrowser()) return
  lifecycleBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

// ---- Public tracking helpers ----

export function trackSessionStart(): void {
  bindLifecycle()
  enqueue({
    event_type: 'session_start',
    path: stripQuery(window.location.pathname),
    page_type: getPageType(window.location.pathname),
    referrer_domain: getExternalReferrerDomain(),
    device_class: getDeviceClass(),
  })
}

export function trackPageView(pathname: string): void {
  bindLifecycle()
  const path = stripQuery(pathname)
  enqueue({
    event_type: 'page_view',
    path,
    page_type: getPageType(path),
    device_class: getDeviceClass(),
  })
}

export function trackRestaurantView(restaurantId: string): void {
  enqueue({
    event_type: 'restaurant_view',
    restaurant_id: restaurantId,
    device_class: getDeviceClass(),
  })
}

export function trackOutbound(target: OutboundTarget, restaurantId?: string): void {
  enqueue({
    event_type: 'outbound_click',
    target,
    restaurant_id: restaurantId,
    device_class: getDeviceClass(),
  })
}

export function trackFeature(feature: UsageFeature): void {
  enqueue({
    event_type: 'feature_use',
    feature,
    device_class: getDeviceClass(),
  })
}

/** Test hook: reset module state between tests. */
export function _resetForTests(): void {
  queue = []
  sessionId = null
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  lifecycleBound = false
}
