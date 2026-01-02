"use client"

import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  trend,
  className
}: StatsCardProps) {
  return (
    <div className={cn("stat-card", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="stat-label truncate">{title}</p>
          <p className="stat-value">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-primary/10 shrink-0", iconColor)}>
            <Icon className="size-5" />
          </div>
        )}
      </div>

      {trend && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium mt-3 pt-3 border-t border-border",
            trend.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}
        >
          <span className="text-base">{trend.isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
          <span className="text-muted-foreground font-normal">מהשבוע שעבר</span>
        </div>
      )}
    </div>
  )
}

// Grid layout for multiple stats
interface StatsGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function StatsGrid({ children, columns = 4, className }: StatsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4"
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  )
}

// Mini stat for inline display
interface MiniStatProps {
  label: string
  value: string | number
  icon?: LucideIcon
  className?: string
}

export function MiniStat({ label, value, icon: Icon, className }: MiniStatProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {Icon && <Icon className="size-4 text-muted-foreground" />}
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}

// Large hero stat for dashboard headers
interface HeroStatProps {
  title: string
  value: string | number
  description?: string
  className?: string
}

export function HeroStat({ title, value, description, className }: HeroStatProps) {
  return (
    <div className={cn("text-center p-6", className)}>
      <p className="text-4xl md:text-5xl font-bold text-primary mb-2">{value}</p>
      <p className="text-lg font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}
