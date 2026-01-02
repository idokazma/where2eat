"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { Utensils, ImageOff } from "lucide-react"

interface ImageWithFallbackProps {
  src?: string | null
  alt: string
  className?: string
  fallbackIcon?: React.ReactNode
  cuisineType?: string
  fill?: boolean
  width?: number
  height?: number
}

// Gradient backgrounds based on cuisine type
const CUISINE_GRADIENTS: Record<string, string> = {
  'אסייאתי': 'from-red-500/20 via-orange-400/15 to-yellow-500/10',
  'סיני': 'from-red-600/20 via-yellow-500/15 to-red-400/10',
  'יפני': 'from-pink-500/20 via-red-400/15 to-white/10',
  'תאילנדי': 'from-green-500/20 via-yellow-400/15 to-red-500/10',
  'הודי': 'from-orange-500/25 via-yellow-400/15 to-red-500/10',
  'איטלקי': 'from-green-500/20 via-white/10 to-red-500/15',
  'ים תיכוני': 'from-blue-400/20 via-cyan-300/15 to-yellow-400/10',
  'יווני': 'from-blue-500/20 via-white/10 to-blue-400/15',
  'מקסיקני': 'from-green-500/20 via-white/10 to-red-500/15',
  'אמריקאי': 'from-red-500/20 via-white/10 to-blue-500/15',
  'ישראלי': 'from-blue-500/20 via-white/15 to-blue-400/10',
  'מזרחי': 'from-amber-500/20 via-orange-400/15 to-red-500/10',
  'בשרי': 'from-red-600/25 via-orange-500/15 to-amber-400/10',
  'דגים': 'from-blue-400/20 via-cyan-300/15 to-blue-500/10',
  'טבעוני': 'from-green-500/25 via-lime-400/15 to-green-300/10',
  'צמחוני': 'from-green-400/20 via-lime-300/15 to-yellow-400/10',
  'קפה': 'from-amber-700/25 via-amber-500/15 to-amber-300/10',
  'מאפים': 'from-amber-400/20 via-yellow-300/15 to-orange-300/10',
  'default': 'from-primary/20 via-primary/10 to-primary/5'
}

// Cuisine type icons (emoji fallbacks)
const CUISINE_ICONS: Record<string, string> = {
  'אסייאתי': '🍜',
  'סיני': '🥡',
  'יפני': '🍣',
  'תאילנדי': '🍛',
  'הודי': '🍛',
  'איטלקי': '🍕',
  'ים תיכוני': '🥗',
  'יווני': '🥙',
  'מקסיקני': '🌮',
  'אמריקאי': '🍔',
  'ישראלי': '🥙',
  'מזרחי': '🧆',
  'בשרי': '🥩',
  'דגים': '🐟',
  'טבעוני': '🥬',
  'צמחוני': '🥗',
  'קפה': '☕',
  'מאפים': '🥐',
  'default': '🍽️'
}

export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackIcon,
  cuisineType,
  fill = true,
  width,
  height
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const gradient = cuisineType
    ? (CUISINE_GRADIENTS[cuisineType] || CUISINE_GRADIENTS.default)
    : CUISINE_GRADIENTS.default

  const cuisineIcon = cuisineType
    ? (CUISINE_ICONS[cuisineType] || CUISINE_ICONS.default)
    : CUISINE_ICONS.default

  // Show fallback if no source or error
  if (!src || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br",
          gradient,
          className
        )}
        role="img"
        aria-label={alt}
      >
        {fallbackIcon || (
          <div className="flex flex-col items-center gap-2 opacity-60">
            <span className="text-4xl">{cuisineIcon}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Loading shimmer */}
      {isLoading && (
        <div
          className={cn(
            "absolute inset-0 skeleton-shimmer bg-gradient-to-br",
            gradient
          )}
        />
      )}

      {/* Actual image */}
      {fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          className={cn(
            "object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width || 400}
          height={height || 300}
          className={cn(
            "object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  )
}

// Simple placeholder component for empty states
export function ImagePlaceholder({
  className,
  message = "אין תמונה"
}: {
  className?: string
  message?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 bg-muted",
        className
      )}
    >
      <ImageOff className="size-8 text-muted-foreground/50" />
      <span className="text-xs text-muted-foreground">{message}</span>
    </div>
  )
}
