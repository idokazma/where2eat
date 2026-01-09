"use client"

import { onCLS, onLCP, onFCP, onTTFB, onINP } from 'web-vitals'

export interface WebVitalsMetric {
  id: string
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

export function reportWebVitals(onPerfEntry?: (metric: WebVitalsMetric) => void) {
  if (!onPerfEntry || typeof window === 'undefined') return

  onCLS((metric: any) => onPerfEntry(metric as WebVitalsMetric))
  onLCP((metric: any) => onPerfEntry(metric as WebVitalsMetric))
  onFCP((metric: any) => onPerfEntry(metric as WebVitalsMetric))
  onTTFB((metric: any) => onPerfEntry(metric as WebVitalsMetric))
  onINP((metric: any) => onPerfEntry(metric as WebVitalsMetric))
}

export function logMetricToConsole(metric: WebVitalsMetric) {
  const { name, value, rating } = metric

  const color = rating === 'good' ? 'green' : rating === 'needs-improvement' ? 'orange' : 'red'

  console.log(
    `%c${name}: ${value.toFixed(2)}ms [${rating}]`,
    `color: ${color}; font-weight: bold;`
  )
}

// Send metrics to analytics endpoint (optional)
export function sendMetricToAnalytics(metric: WebVitalsMetric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    timestamp: Date.now(),
    url: window.location.href
  })

  // Send to your analytics endpoint
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics', body)
  } else {
    fetch('/api/analytics', {
      body,
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(console.error)
  }
}
