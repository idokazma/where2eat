"use client"

import { useMemo } from "react"
import Masonry from "react-masonry-css"
import { Restaurant } from "@/types/restaurant"
import { VisualRestaurantCard } from "./visual-restaurant-card"

interface MasonryRestaurantGridProps {
  restaurants: Restaurant[]
  isLoading?: boolean
}

export function MasonryRestaurantGrid({
  restaurants,
  isLoading = false
}: MasonryRestaurantGridProps) {
  // Responsive column configuration
  const breakpointColumnsObj = {
    default: 4,  // Large desktops
    1536: 3,     // Desktop
    1024: 2,     // Tablet
    640: 1       // Mobile
  }

  // Randomize aspect ratios for visual variety
  const restaurantsWithAspects = useMemo(() => {
    const aspectRatios: ("square" | "portrait" | "landscape" | "wide")[] = [
      "landscape",
      "portrait",
      "square",
      "wide"
    ]

    return restaurants.map((restaurant, index) => ({
      restaurant,
      aspectRatio: aspectRatios[index % aspectRatios.length]
    }))
  }, [restaurants])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-landscape shimmer rounded-xl" />
            <div className="h-4 shimmer rounded w-3/4" />
            <div className="h-3 shimmer rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-8xl mb-4">🍽️</div>
        <p className="text-xl font-semibold mb-2">לא נמצאו מסעדות</p>
        <p className="text-sm">נסה לשנות את הסינון או החיפוש</p>
      </div>
    )
  }

  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="masonry-grid -ml-6"
      columnClassName="masonry-column pl-6"
    >
      {restaurantsWithAspects.map(({ restaurant, aspectRatio }, index) => (
        <div key={`${restaurant.name_hebrew}-${index}`} className="mb-6">
          <VisualRestaurantCard
            restaurant={restaurant}
            aspectRatio={aspectRatio}
          />
        </div>
      ))}
    </Masonry>
  )
}
