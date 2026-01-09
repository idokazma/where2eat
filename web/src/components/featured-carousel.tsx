"use client"

import { useState, useEffect, useCallback } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { VisualRestaurantCard } from "./visual-restaurant-card"
import { Button } from "./ui/button"

interface FeaturedCarouselProps {
  restaurants: Restaurant[]
  autoplay?: boolean
  autoplayDelay?: number
}

export function FeaturedCarousel({
  restaurants,
  autoplay = true,
  autoplayDelay = 5000
}: FeaturedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    skipSnaps: false,
    dragFree: false,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev()
  }, [emblaApi])

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext()
  }, [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
  }, [emblaApi, onSelect])

  // Autoplay
  useEffect(() => {
    if (!autoplay || !emblaApi) return

    const interval = setInterval(() => {
      if (emblaApi) emblaApi.scrollNext()
    }, autoplayDelay)

    return () => clearInterval(interval)
  }, [emblaApi, autoplay, autoplayDelay])

  if (restaurants.length === 0) return null

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {restaurants.map((restaurant, index) => (
            <div
              key={`carousel-${restaurant.name_hebrew}-${index}`}
              className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
            >
              <VisualRestaurantCard
                restaurant={restaurant}
                aspectRatio="landscape"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      {restaurants.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg"
            onClick={scrollNext}
            disabled={!canScrollNext}
          >
            <ChevronRight className="size-4" />
          </Button>
        </>
      )}

      {/* Progress Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {restaurants.map((_, index) => (
          <button
            key={index}
            className={`h-2 rounded-full transition-all ${
              index === selectedIndex
                ? 'w-8 bg-primary'
                : 'w-2 bg-gray-300 hover:bg-gray-400'
            }`}
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
