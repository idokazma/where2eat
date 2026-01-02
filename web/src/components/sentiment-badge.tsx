"use client"

import { cn } from "@/lib/utils"
import { ThumbsUp, ThumbsDown, HelpCircle, Minus } from "lucide-react"

type Sentiment = 'positive' | 'negative' | 'mixed' | 'neutral'

interface SentimentBadgeProps {
  sentiment: Sentiment
  showLabel?: boolean
  showEmoji?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SENTIMENT_MAP = {
  positive: {
    icon: ThumbsUp,
    emoji: '👍',
    label: 'מומלץ',
    labelEn: 'Recommended',
    className: 'sentiment-positive',
    color: 'text-green-600 dark:text-green-400'
  },
  negative: {
    icon: ThumbsDown,
    emoji: '👎',
    label: 'לא מומלץ',
    labelEn: 'Not Recommended',
    className: 'sentiment-negative',
    color: 'text-red-600 dark:text-red-400'
  },
  mixed: {
    icon: HelpCircle,
    emoji: '🤔',
    label: 'מעורב',
    labelEn: 'Mixed',
    className: 'sentiment-mixed',
    color: 'text-amber-600 dark:text-amber-400'
  },
  neutral: {
    icon: Minus,
    emoji: '😐',
    label: 'ניטרלי',
    labelEn: 'Neutral',
    className: 'sentiment-neutral',
    color: 'text-gray-600 dark:text-gray-400'
  }
} as const

const SIZE_MAP = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2'
}

const ICON_SIZE_MAP = {
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-5'
}

export function SentimentBadge({
  sentiment,
  showLabel = true,
  showEmoji = true,
  size = 'md',
  className
}: SentimentBadgeProps) {
  const config = SENTIMENT_MAP[sentiment]

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        config.className,
        SIZE_MAP[size],
        className
      )}
      title={config.labelEn}
    >
      {showEmoji && <span>{config.emoji}</span>}
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

// Icon-only variant for compact displays
export function SentimentIcon({
  sentiment,
  size = 'md',
  className
}: {
  sentiment: Sentiment
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const config = SENTIMENT_MAP[sentiment]
  const Icon = config.icon

  return (
    <Icon
      className={cn(ICON_SIZE_MAP[size], config.color, className)}
      aria-label={config.labelEn}
    />
  )
}

// Get sentiment config for external use
export function getSentimentConfig(sentiment: Sentiment) {
  return SENTIMENT_MAP[sentiment]
}
