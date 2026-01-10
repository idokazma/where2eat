"use client"

import { useMemo } from "react"
import Masonry from "react-masonry-css"
import { Restaurant } from "@/types/restaurant"
import { VisualRestaurantCard } from "./visual-restaurant-card"
import { GridSkeleton } from "./skeletons/grid-skeleton"
import { useLanguage } from "@/contexts/LanguageContext"

interface MasonryRestaurantGridProps {
  restaurants: Restaurant[]
  isLoading?: boolean
}

export function MasonryRestaurantGrid({
  restaurants,
  isLoading = false
}: MasonryRestaurantGridProps) {
  const { t } = useLanguage()
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
    return <GridSkeleton count={8} />
  }

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-8xl mb-4">🍽️</div>
        <p className="text-xl font-semibold mb-2">{t('errors.noResults')}</p>
        <p className="text-sm">{t('errors.tryChangingFilters')}</p>
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
