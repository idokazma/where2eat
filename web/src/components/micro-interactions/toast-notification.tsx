"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastNotificationProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle
}

const toastColors = {
  success: "bg-success",
  error: "bg-destructive",
  info: "bg-info",
  warning: "bg-warning"
}

export function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type]
          const colorClass = toastColors[toast.type]

          return (
            <ToastItem
              key={toast.id}
              toast={toast}
              Icon={Icon}
              colorClass={colorClass}
              onDismiss={onDismiss}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({
  toast,
  Icon,
  colorClass,
  onDismiss
}: {
  toast: Toast
  Icon: React.ComponentType<{ className?: string }>
  colorClass: string
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, toast.duration || 5000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) {
          onDismiss(toast.id)
        }
      }}
      className={`${colorClass} text-white rounded-lg shadow-lg p-4 flex items-center gap-3 cursor-pointer`}
      onClick={() => onDismiss(toast.id)}
    >
      <Icon className="size-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDismiss(toast.id)
        }}
        className="flex-shrink-0 hover:bg-white/20 rounded p-1"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  )
}
