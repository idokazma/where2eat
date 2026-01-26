"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useLanguage } from "@/contexts/LanguageContext"

interface LocationFilterProps {
  restaurants: Restaurant[]
  selectedCity: string
  selectedRegion: string
  selectedNeighborhood: string
  onCityChange: (city: string) => void
  onRegionChange: (region: string) => void
  onNeighborhoodChange: (neighborhood: string) => void
}

export function LocationFilter({
  restaurants,
  selectedCity,
  selectedRegion,
  selectedNeighborhood,
  onCityChange,
  onRegionChange,
  onNeighborhoodChange
}: LocationFilterProps) {
  const { t } = useLanguage()

  const locations = useMemo(() => {
    const cities = new Set<string>()
    const regions = new Set<string>()
    const neighborhoods = new Set<string>()

    restaurants.forEach(restaurant => {
      if (restaurant.location?.city) cities.add(restaurant.location.city)
      if (restaurant.location?.region) regions.add(restaurant.location.region)
      if (restaurant.location?.neighborhood) neighborhoods.add(restaurant.location.neighborhood)
    })

    return {
      cities: Array.from(cities).sort(),
      regions: Array.from(regions).sort(),
      neighborhoods: Array.from(neighborhoods).sort()
    }
  }, [restaurants])

  const getCounts = (filterType: 'city' | 'region' | 'neighborhood', value: string) => {
    return restaurants.filter(r => {
      if (filterType === 'city') return r.location?.city === value
      if (filterType === 'region') return r.location?.region === value
      if (filterType === 'neighborhood') return r.location?.neighborhood === value
      return false
    }).length
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="size-5 text-orange-500" />
        <h3 className="font-semibold text-gray-700">{t('filters.location.title')}</h3>
      </div>

      {/* Region Filter */}
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-2">{t('filters.location.region')}</h4>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedRegion === "all" ? "default" : "outline"}
            className={`cursor-pointer transition-all ${
              selectedRegion === "all"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                : "hover:bg-blue-100 border-blue-200"
            }`}
            onClick={() => onRegionChange("all")}
          >
            {t('filters.location.allRegions')} ({restaurants.length})
          </Badge>
          {locations.regions.map(region => (
            <Badge
              key={region}
              variant={selectedRegion === region ? "default" : "outline"}
              className={`cursor-pointer transition-all ${
                selectedRegion === region
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600"
                  : "hover:bg-blue-100 border-blue-200"
              }`}
              onClick={() => onRegionChange(region)}
            >
              {region} ({getCounts('region', region)})
            </Badge>
          ))}
        </div>
      </div>

      {/* City Filter */}
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-2">{t('filters.location.city')}</h4>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedCity === "all" ? "default" : "outline"}
            className={`cursor-pointer transition-all ${
              selectedCity === "all"
                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
                : "hover:bg-green-100 border-green-200"
            }`}
            onClick={() => onCityChange("all")}
          >
            {t('filters.location.allCities')}
          </Badge>
          {locations.cities.map(city => (
            <Badge
              key={city}
              variant={selectedCity === city ? "default" : "outline"}
              className={`cursor-pointer transition-all ${
                selectedCity === city
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
                  : "hover:bg-green-100 border-green-200"
              }`}
              onClick={() => onCityChange(city)}
            >
              {city} ({getCounts('city', city)})
            </Badge>
          ))}
        </div>
      </div>

      {/* Neighborhood Filter */}
      {locations.neighborhoods.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-600 mb-2">{t('filters.location.neighborhood')}</h4>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={selectedNeighborhood === "all" ? "default" : "outline"}
              className={`cursor-pointer transition-all ${
                selectedNeighborhood === "all"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                  : "hover:bg-purple-100 border-purple-200"
              }`}
              onClick={() => onNeighborhoodChange("all")}
            >
              {t('filters.location.allNeighborhoods')}
            </Badge>
            {locations.neighborhoods.map(neighborhood => (
              <Badge
                key={neighborhood}
                variant={selectedNeighborhood === neighborhood ? "default" : "outline"}
                className={`cursor-pointer transition-all ${
                  selectedNeighborhood === neighborhood
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                    : "hover:bg-purple-100 border-purple-200"
                }`}
                onClick={() => onNeighborhoodChange(neighborhood)}
              >
                {neighborhood} ({getCounts('neighborhood', neighborhood)})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
