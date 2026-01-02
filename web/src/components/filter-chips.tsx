"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

export interface FilterOption {
  id: string
  label: string
  icon?: React.ReactNode
  emoji?: string
  count?: number
}

interface FilterChipsProps {
  options: FilterOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  multiSelect?: boolean
  showCounts?: boolean
  className?: string
  label?: string
}

export function FilterChips({
  options,
  selected,
  onChange,
  multiSelect = true,
  showCounts = true,
  className,
  label
}: FilterChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    // RTL: scrollLeft is negative in RTL mode
    const isRTL = document.documentElement.dir === 'rtl'

    if (isRTL) {
      setShowRightArrow(scrollLeft < 0)
      setShowLeftArrow(Math.abs(scrollLeft) + clientWidth < scrollWidth - 10)
    } else {
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    const ref = scrollRef.current
    if (ref) {
      ref.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
    }
    return () => {
      if (ref) {
        ref.removeEventListener('scroll', checkScroll)
      }
      window.removeEventListener('resize', checkScroll)
    }
  }, [options])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 200
    const isRTL = document.documentElement.dir === 'rtl'
    const scrollAmount = isRTL
      ? (direction === 'left' ? amount : -amount)
      : (direction === 'left' ? -amount : amount)

    scrollRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    })
  }

  const toggleOption = (optionId: string) => {
    if (multiSelect) {
      if (selected.includes(optionId)) {
        onChange(selected.filter(id => id !== optionId))
      } else {
        onChange([...selected, optionId])
      }
    } else {
      onChange(selected.includes(optionId) ? [] : [optionId])
    }
  }

  const clearAll = () => onChange([])

  return (
    <div className={cn("relative", className)}>
      {/* Label */}
      {label && (
        <span className="text-sm font-medium text-muted-foreground mb-2 block">
          {label}
        </span>
      )}

      <div className="relative">
        {/* Right scroll arrow (appears on left in RTL) */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10
                       bg-gradient-to-l from-background via-background/95 to-transparent
                       pl-6 pr-1 py-2 flex items-center"
            aria-label="גלול ימינה"
          >
            <ChevronRight className="size-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}

        {/* Left scroll arrow (appears on right in RTL) */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10
                       bg-gradient-to-r from-background via-background/95 to-transparent
                       pr-6 pl-1 py-2 flex items-center"
            aria-label="גלול שמאלה"
          >
            <ChevronLeft className="size-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}

        {/* Chips Container */}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scroll-container py-1 px-1 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Clear All Button - only show when there are selections */}
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              className="filter-chip shrink-0 bg-destructive/10 text-destructive border-destructive/20
                         hover:bg-destructive/20 hover:border-destructive/40"
            >
              <X className="size-3" />
              <span>נקה ({selected.length})</span>
            </button>
          )}

          {/* Filter Options */}
          {options.map((option) => {
            const isSelected = selected.includes(option.id)
            return (
              <button
                key={option.id}
                onClick={() => toggleOption(option.id)}
                className={cn(
                  "filter-chip shrink-0",
                  isSelected && "filter-chip-active"
                )}
                aria-pressed={isSelected}
              >
                {option.emoji && <span>{option.emoji}</span>}
                {option.icon}
                <span>{option.label}</span>
                {showCounts && option.count !== undefined && (
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {option.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Preset filter configurations
export const CUISINE_FILTERS: FilterOption[] = [
  { id: 'israeli', label: 'ישראלי', emoji: '🥙' },
  { id: 'italian', label: 'איטלקי', emoji: '🍕' },
  { id: 'asian', label: 'אסייאתי', emoji: '🍜' },
  { id: 'japanese', label: 'יפני', emoji: '🍣' },
  { id: 'american', label: 'אמריקאי', emoji: '🍔' },
  { id: 'mediterranean', label: 'ים תיכוני', emoji: '🥗' },
  { id: 'indian', label: 'הודי', emoji: '🍛' },
  { id: 'mexican', label: 'מקסיקני', emoji: '🌮' },
  { id: 'middle-eastern', label: 'מזרחי', emoji: '🧆' },
  { id: 'seafood', label: 'דגים', emoji: '🐟' },
  { id: 'vegan', label: 'טבעוני', emoji: '🥬' },
  { id: 'cafe', label: 'קפה', emoji: '☕' },
]

export const OPINION_FILTERS: FilterOption[] = [
  { id: 'positive', label: 'מומלץ', emoji: '👍' },
  { id: 'mixed', label: 'מעורב', emoji: '🤔' },
  { id: 'negative', label: 'לא מומלץ', emoji: '👎' },
  { id: 'neutral', label: 'ניטרלי', emoji: '😐' },
]

export const PRICE_FILTERS: FilterOption[] = [
  { id: 'budget', label: '₪', emoji: '' },
  { id: 'mid-range', label: '₪₪', emoji: '' },
  { id: 'expensive', label: '₪₪₪', emoji: '' },
]

export const REGION_FILTERS: FilterOption[] = [
  { id: 'north', label: 'צפון', emoji: '🏔️' },
  { id: 'center', label: 'מרכז', emoji: '🏙️' },
  { id: 'south', label: 'דרום', emoji: '🏜️' },
]
