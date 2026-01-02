"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("skeleton-shimmer rounded-md", className)} />
  )
}

export function RestaurantCardSkeleton() {
  return (
    <div className="w-full rounded-xl border border-border overflow-hidden bg-card">
      {/* Image skeleton */}
      <Skeleton className="h-40 w-full rounded-none" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="flex justify-between items-start">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>

        {/* Badges */}
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Sentiment + expand */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Comment preview */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}

export function SearchSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full shrink-0" />
        ))}
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}
