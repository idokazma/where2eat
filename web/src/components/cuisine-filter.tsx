"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Utensils } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useLanguage } from "@/contexts/LanguageContext"

interface CuisineFilterProps {
  restaurants: Restaurant[]
  selectedCuisines: string[]
  onCuisineChange: (cuisines: string[]) => void
}

export function CuisineFilter({ restaurants, selectedCuisines, onCuisineChange }: CuisineFilterProps) {
  const { t } = useLanguage()

  const cuisineData = useMemo(() => {
    const cuisineMap = new Map<string, number>()

    restaurants.forEach(restaurant => {
      const cuisine = restaurant.cuisine_type
      if (cuisine) {
        cuisineMap.set(cuisine, (cuisineMap.get(cuisine) || 0) + 1)
      }
    })

    return Array.from(cuisineMap.entries())
      .map(([cuisine, count]) => ({ cuisine, count }))
      .sort((a, b) => b.count - a.count)
  }, [restaurants])

  const toggleCuisine = (cuisine: string) => {
    if (selectedCuisines.includes(cuisine)) {
      onCuisineChange(selectedCuisines.filter(c => c !== cuisine))
    } else {
      onCuisineChange([...selectedCuisines, cuisine])
    }
  }

  const clearAllCuisines = () => {
    onCuisineChange([])
  }

  const selectAllCuisines = () => {
    onCuisineChange(cuisineData.map(item => item.cuisine))
  }

  const isAllSelected = selectedCuisines.length === cuisineData.length
  const isNoneSelected = selectedCuisines.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Utensils className="size-5 text-orange-500" />
        <h3 className="font-semibold text-gray-700">{t('filters.cuisine.title')}</h3>
        <span className="text-sm text-gray-500">
          ({selectedCuisines.length === 0 ? t('common.all') : selectedCuisines.length} {t('filters.cuisine.selected')})
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2 mb-3">
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-orange-100 border-orange-200"
          onClick={clearAllCuisines}
        >
          {t('common.clearAll')}
        </Badge>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-orange-100 border-orange-200"
          onClick={selectAllCuisines}
        >
          {t('common.selectAll')}
        </Badge>
      </div>

      {/* Cuisine badges */}
      <div className="flex flex-wrap gap-2">
        {cuisineData.map(({ cuisine, count }) => {
          const isSelected = selectedCuisines.includes(cuisine) || isNoneSelected

          return (
            <Badge
              key={cuisine}
              variant={isSelected ? "default" : "outline"}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
                  : "hover:bg-orange-100 border-orange-200 opacity-60"
              }`}
              onClick={() => toggleCuisine(cuisine)}
            >
              {cuisine} ({count})
            </Badge>
          )
        })}
      </div>

      {/* Popular cuisines section */}
      {cuisineData.length > 0 && (
        <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <h4 className="text-sm font-medium text-orange-800 mb-2">{t('filters.cuisine.popular')}</h4>
          <div className="flex flex-wrap gap-1">
            {cuisineData.slice(0, 3).map(({ cuisine, count }) => (
              <Badge
                key={cuisine}
                className="bg-orange-100 text-orange-800 border-orange-300"
              >
                {cuisine} - {count} {t('common.restaurants')}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
