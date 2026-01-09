"use client"

import { useEffect } from "react"
import { reportWebVitals, logMetricToConsole, sendMetricToAnalytics } from "@/lib/analytics"

export function WebVitals() {
  useEffect(() => {
    reportWebVitals((metric) => {
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        logMetricToConsole(metric)
      }

      // Send to analytics in production
      if (process.env.NODE_ENV === 'production') {
        sendMetricToAnalytics(metric)
      }
    })
  }, [])

  return null
}
