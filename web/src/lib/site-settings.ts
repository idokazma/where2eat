'use client'

/**
 * Public site-content settings (hero texts, banner, display toggles).
 * Fetched once per page load from the public, whitelisted endpoint.
 * Defaults below mirror the backend defaults so the site renders
 * unchanged when the endpoint is unreachable.
 */

import { useEffect, useState } from 'react'
import { getApiUrl } from './config'

export interface SiteSettings {
  'site.hero_title': string
  'site.hero_highlight': string
  'site.hero_subtitle': string
  'site.banner_text': string
  'site.banner_link': string
  'social.instagram': string
  'social.youtube_mdaberim': string
  'social.youtube_gil': string
  'about.text': string
  'display.restaurant_count': string
  'display.creator_filter': string
  'site.maintenance_mode': string
}

export const SITE_SETTING_DEFAULTS: SiteSettings = {
  'site.hero_title': '',
  'site.hero_highlight': '',
  'site.hero_subtitle': '',
  'site.banner_text': '',
  'site.banner_link': '',
  'social.instagram': '',
  'social.youtube_mdaberim': '',
  'social.youtube_gil': '',
  'about.text': '',
  'display.restaurant_count': 'true',
  'display.creator_filter': 'true',
  'site.maintenance_mode': 'false',
}

let cache: SiteSettings | null = null
let inflight: Promise<SiteSettings> | null = null

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = fetch(getApiUrl('/api/settings/public'))
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => {
      cache = { ...SITE_SETTING_DEFAULTS, ...data }
      return cache as SiteSettings
    })
    .catch(() => {
      cache = { ...SITE_SETTING_DEFAULTS }
      return cache
    })
  return inflight
}

export function useSiteSettings(): { settings: SiteSettings; loaded: boolean } {
  const [settings, setSettings] = useState<SiteSettings>(cache ?? SITE_SETTING_DEFAULTS)
  const [loaded, setLoaded] = useState(cache !== null)

  useEffect(() => {
    let cancelled = false
    fetchSiteSettings().then((s) => {
      if (!cancelled) {
        setSettings(s)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { settings, loaded }
}

/** Test hook: clear the module cache. */
export function _resetSiteSettingsCache(): void {
  cache = null
  inflight = null
}
