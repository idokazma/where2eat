import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted shimmer", className)}
      {...props}
    />
  )
}

// Restaurant Card Skeleton
function RestaurantCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-[var(--color-surface-elevated)] rounded-xl overflow-hidden border border-[var(--color-border)]", className)}>
      {/* Image skeleton */}
      <div className="aspect-[16/10] bg-[var(--color-surface)] shimmer" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-6 w-3/4 bg-[var(--color-surface)] rounded shimmer" />

        {/* Meta info */}
        <div className="flex gap-2">
          <div className="h-4 w-16 bg-[var(--color-surface)] rounded shimmer" />
          <div className="h-4 w-20 bg-[var(--color-surface)] rounded shimmer" />
        </div>

        {/* Quote */}
        <div className="space-y-2 pt-2">
          <div className="h-4 w-full bg-[var(--color-surface)] rounded shimmer" />
          <div className="h-4 w-4/5 bg-[var(--color-surface)] rounded shimmer" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-3">
          <div className="flex-1 h-10 bg-[var(--color-surface)] rounded-full shimmer" />
          <div className="w-10 h-10 bg-[var(--color-surface)] rounded-full shimmer" />
          <div className="w-10 h-10 bg-[var(--color-surface)] rounded-full shimmer" />
        </div>
      </div>
    </div>
  )
}

// Trending Card Skeleton
function TrendingCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-[140px] flex-shrink-0", className)}>
      <div className="aspect-square bg-[var(--color-surface)] rounded-lg shimmer" />
      <div className="mt-2 space-y-1">
        <div className="h-4 w-full bg-[var(--color-surface)] rounded shimmer" />
        <div className="h-3 w-3/4 bg-[var(--color-surface)] rounded shimmer" />
      </div>
    </div>
  )
}

// Filter Chip Skeleton
function FilterChipSkeleton({ className }: { className?: string }) {
  return <div className={cn("w-20 h-8 bg-[var(--color-surface)] rounded-full shimmer", className)} />
}

// Page Loading Skeleton
function PageLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("px-4 py-6 space-y-6", className)}>
      {/* Filter bar skeleton */}
      <div className="flex gap-2 overflow-hidden">
        <FilterChipSkeleton />
        <FilterChipSkeleton />
        <FilterChipSkeleton />
        <FilterChipSkeleton />
      </div>

      {/* Section header skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-6 w-24 bg-[var(--color-surface)] rounded shimmer" />
        <div className="h-4 w-16 bg-[var(--color-surface)] rounded shimmer" />
      </div>

      {/* Trending carousel skeleton */}
      <div className="flex gap-3 overflow-hidden">
        <TrendingCardSkeleton />
        <TrendingCardSkeleton />
        <TrendingCardSkeleton />
      </div>

      {/* Restaurant cards skeleton */}
      <div className="space-y-4">
        <RestaurantCardSkeleton />
        <RestaurantCardSkeleton />
      </div>
    </div>
  )
}

export {
  Skeleton,
  RestaurantCardSkeleton,
  TrendingCardSkeleton,
  FilterChipSkeleton,
  PageLoadingSkeleton
}
