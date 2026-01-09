"use client"

import { ReactNode } from "react"
import Tilt from "react-parallax-tilt"

interface TiltCardProps {
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function TiltCard({ children, className = "", disabled = false }: TiltCardProps) {
  // Disable tilt on touch devices for performance
  const isTouchDevice = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  if (disabled || isTouchDevice) {
    return <div className={className}>{children}</div>
  }

  return (
    <Tilt
      className={className}
      tiltMaxAngleX={10}
      tiltMaxAngleY={10}
      perspective={1000}
      scale={1.02}
      transitionSpeed={400}
      gyroscope={false}
      glareEnable={true}
      glareMaxOpacity={0.2}
      glareColor="#ffffff"
      glarePosition="all"
    >
      {children}
    </Tilt>
  )
}
