"use client"

import { useEffect, useRef, useState } from "react"
import { OptimizedImage } from "./optimized-image"

interface ParallaxHeroProps {
  title: string
  subtitle?: string
  backgroundImage?: string
  children?: React.ReactNode
}

export function ParallaxHero({
  title,
  subtitle,
  backgroundImage,
  children
}: ParallaxHeroProps) {
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const handleScroll = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect()
        // Only calculate parallax when hero is in view
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          setScrollY(window.scrollY)
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate parallax transforms
  const backgroundTransform = `translateY(${scrollY * 0.3}px)`
  const contentTransform = `translateY(${scrollY * 0.1}px)`

  return (
    <div
      ref={heroRef}
      className="relative h-[60vh] min-h-[400px] overflow-hidden rounded-2xl"
    >
      {/* Background layer - slowest */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: backgroundTransform }}
      >
        {backgroundImage ? (
          <OptimizedImage
            src={backgroundImage}
            alt={title}
            className="w-full h-[120%]"
            aspectRatio="wide"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500" />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {/* Content layer - faster */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4 will-change-transform"
        style={{ transform: contentTransform }}
      >
        <h1 className="image-headline text-white mb-4 drop-shadow-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl drop-shadow-lg">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="mt-8">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
