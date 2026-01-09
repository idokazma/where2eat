"use client"

import { useState, useCallback } from "react"
import { Toast, ToastType } from "@/components/micro-interactions/toast-notification"

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = "info", duration?: number) => {
    const id = Math.random().toString(36).substring(7)
    const newToast: Toast = { id, message, type, duration }
    setToasts(prev => [...prev, newToast])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => {
    showToast(message, "success", duration)
  }, [showToast])

  const error = useCallback((message: string, duration?: number) => {
    showToast(message, "error", duration)
  }, [showToast])

  const info = useCallback((message: string, duration?: number) => {
    showToast(message, "info", duration)
  }, [showToast])

  const warning = useCallback((message: string, duration?: number) => {
    showToast(message, "warning", duration)
  }, [showToast])

  return {
    toasts,
    showToast,
    dismissToast,
    success,
    error,
    info,
    warning
  }
}
