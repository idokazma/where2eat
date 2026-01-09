"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface CardSkeletonProps {
  aspectRatio?: "square" | "portrait" | "landscape" | "wide"
}

export function CardSkeleton({ aspectRatio = "landscape" }: CardSkeletonProps) {
  const aspectClasses = {
    square: "aspect-square",
    portrait: "aspect-portrait",
    landscape: "aspect-landscape",
    wide: "aspect-wide"
  }

  return (
    <Card className="overflow-hidden border-0 shadow-md">
      {/* Image skeleton */}
      <Skeleton className={`w-full ${aspectClasses[aspectRatio]} rounded-none`} />

      {/* Content skeleton */}
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </CardContent>
    </Card>
  )
}
