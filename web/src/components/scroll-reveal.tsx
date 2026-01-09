"use client"

import { useEffect, useRef, useState, ReactNode } from "react"
import { useInView } from "react-intersection-observer"

interface ScrollRevealProps {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: "up" | "down" | "left" | "right" | "fade"
  className?: string
}

export function ScrollReveal({
  children,
  delay = 0,
  duration = 500,
  direction = "up",
  className = ""
}: ScrollRevealProps) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: "50px"
  })

  useEffect(() => {
    if (inView && !hasAnimated) {
      setHasAnimated(true)
    }
  }, [inView, hasAnimated])

  // Check if user prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  const getInitialTransform = () => {
    switch (direction) {
      case "up":
        return "translateY(30px)"
      case "down":
        return "translateY(-30px)"
      case "left":
        return "translateX(30px)"
      case "right":
        return "translateX(-30px)"
      case "fade":
        return "translateY(0)"
      default:
        return "translateY(30px)"
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: hasAnimated ? 1 : 0,
        transform: hasAnimated ? "translate(0, 0)" : getInitialTransform(),
        transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`
      }}
    >
      {children}
    </div>
  )
}
