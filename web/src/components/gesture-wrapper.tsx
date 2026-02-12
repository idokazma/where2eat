"use client"

import { ReactNode } from "react"
import { useDrag } from "@use-gesture/react"
import type { EventTypes } from "@use-gesture/react"
import { motion, useSpring } from "framer-motion"

interface GestureWrapperProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  className?: string
}

export function GestureWrapper({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  className = ""
}: GestureWrapperProps) {
  const x = useSpring(0, { stiffness: 300, damping: 30 })
  const y = useSpring(0, { stiffness: 300, damping: 30 })

  const bind = useDrag(
    ({ movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], last }) => {
      if (last) {
        // Check for swipe gestures (fast movement)
        const swipeThreshold = 0.5
        const distanceThreshold = 50

        if (Math.abs(vx) > swipeThreshold && Math.abs(mx) > distanceThreshold) {
          if (dx < 0 && onSwipeLeft) {
            onSwipeLeft()
          } else if (dx > 0 && onSwipeRight) {
            onSwipeRight()
          }
        }

        if (Math.abs(vy) > swipeThreshold && Math.abs(my) > distanceThreshold) {
          if (dy < 0 && onSwipeUp) {
            onSwipeUp()
          } else if (dy > 0 && onSwipeDown) {
            onSwipeDown()
          }
        }

        // Reset position
        x.set(0)
        y.set(0)
      } else {
        // Follow finger during drag
        x.set(mx * 0.3) // Dampen the movement
        y.set(my * 0.3)
      }
    },
    {
      axis: undefined, // Allow both axes
      filterTaps: true,
      rubberband: true
    }
  )

  const dragHandlers = bind() as ReturnType<typeof useDrag<EventTypes['drag']>>

  return (
    <motion.div
      {...dragHandlers}
      style={{ x, y, touchAction: 'pan-y' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
