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
  const [isLoaded, setIsLoaded] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Trigger entrance animation
    setIsLoaded(true)

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
      className="relative h-[55vh] min-h-[420px] overflow-hidden rounded-3xl"
    >
      {/* Background layer - mesh gradient with depth */}
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
          /* Mesh gradient background - editorial warm tones */
          <div className="w-full h-[120%] bg-mesh-warm relative">
            {/* Animated floating shapes for depth */}
            <div
              className="floating-shape w-[500px] h-[500px] bg-white/10 top-[-100px] left-[-100px] animate-float"
              aria-hidden="true"
            />
            <div
              className="floating-shape w-[400px] h-[400px] bg-amber-300/15 bottom-[-150px] right-[-50px] animate-float-delayed"
              aria-hidden="true"
            />
            <div
              className="floating-shape w-[300px] h-[300px] bg-rose-300/10 top-[20%] right-[20%] animate-float"
              style={{ animationDelay: '-2s' }}
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      {/* Grain texture overlay for cinematic feel */}
      <div className="absolute inset-0 grain-overlay pointer-events-none" aria-hidden="true" />

      {/* Gradient overlay - cinematic vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
      <div className="absolute inset-0 image-overlay-vignette" />

      {/* Content layer - faster parallax */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6 will-change-transform transition-all duration-1000 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transform: isLoaded ? contentTransform : undefined }}
      >
        {/* Decorative line above title */}
        <div
          className={`w-16 h-1 bg-white/60 rounded-full mb-6 transition-all duration-700 delay-300 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          }`}
          aria-hidden="true"
        />

        <h1
          className={`font-display text-white mb-5 drop-shadow-2xl transition-all duration-700 delay-100 ${
            isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{
            fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            textShadow: '0 4px 20px rgba(0,0,0,0.4), 0 8px 40px rgba(0,0,0,0.2)'
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className={`text-lg md:text-xl lg:text-2xl text-white/85 max-w-2xl drop-shadow-lg font-light transition-all duration-700 delay-200 ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ letterSpacing: '0.01em' }}
          >
            {subtitle}
          </p>
        )}

        {children && (
          <div
            className={`mt-10 transition-all duration-700 delay-400 ${
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {children}
          </div>
        )}
      </div>

      {/* Bottom gradient fade for seamless transition */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />
    </div>
  )
}
