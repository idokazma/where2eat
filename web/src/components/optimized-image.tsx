"use client"

import { useState } from "react"
import Image from "next/image"
import { useInView } from "react-intersection-observer"

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  aspectRatio?: "square" | "portrait" | "landscape" | "wide"
  priority?: boolean
  fallbackSrc?: string
}

export function OptimizedImage({
  src,
  alt,
  className = "",
  aspectRatio = "landscape",
  priority = false,
  fallbackSrc = "/placeholder-restaurant.jpg"
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(src || fallbackSrc)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: "50px"
  })

  const handleError = () => {
    setHasError(true)
    setImageSrc(fallbackSrc)
    setIsLoading(false)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  // Get aspect ratio class
  const aspectClasses = {
    square: "aspect-square",
    portrait: "aspect-portrait",
    landscape: "aspect-landscape",
    wide: "aspect-wide"
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${aspectClasses[aspectRatio]} ${className}`}
    >
      {/* Shimmer loading effect */}
      {isLoading && (
        <div className="absolute inset-0 shimmer bg-gray-200 dark:bg-gray-800" />
      )}

      {/* Image */}
      {(inView || priority) && (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          className={`object-cover transition-opacity duration-500 ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
          onError={handleError}
          onLoad={handleLoad}
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      )}

      {/* Error fallback with icon */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900 dark:to-amber-900">
          <div className="text-center">
            <span className="text-6xl">🍽️</span>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {alt}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
