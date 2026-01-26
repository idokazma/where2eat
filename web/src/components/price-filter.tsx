"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { DollarSign } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useLanguage } from "@/contexts/LanguageContext"

interface PriceFilterProps {
  restaurants: Restaurant[]
  selectedPriceRanges: string[]
  onPriceRangeChange: (priceRanges: string[]) => void
}

export function PriceFilter({ restaurants, selectedPriceRanges, onPriceRangeChange }: PriceFilterProps) {
  const { t } = useLanguage()

  const priceRangeConfig = useMemo(() => ({
    'budget': {
      label: t('filters.price.budget'),
      icon: '₪',
      color: 'from-green-500 to-emerald-500',
      description: t('filters.price.budgetRestaurants')
    },
    'mid-range': {
      label: t('filters.price.midRange'),
      icon: '₪₪',
      color: 'from-yellow-500 to-orange-500',
      description: t('filters.price.midRangeRestaurants')
    },
    'expensive': {
      label: t('filters.price.expensive'),
      icon: '₪₪₪',
      color: 'from-red-500 to-pink-500',
      description: t('filters.price.expensiveRestaurants')
    },
    'not_mentioned': {
      label: t('filters.price.notMentioned'),
      icon: '?',
      color: 'from-gray-500 to-slate-500',
      description: t('filters.price.notSpecified')
    }
  }), [t])

  const priceData = useMemo(() => {
    const priceMap = new Map<string, number>()

    restaurants.forEach(restaurant => {
      const priceRange = restaurant.price_range
      if (priceRange) {
        priceMap.set(priceRange, (priceMap.get(priceRange) || 0) + 1)
      }
    })

    // Return in specific order: budget, mid-range, expensive, not_mentioned
    const orderedPrices = ['budget', 'mid-range', 'expensive', 'not_mentioned']
    return orderedPrices
      .filter(price => priceMap.has(price))
      .map(price => ({
        priceRange: price,
        count: priceMap.get(price) || 0,
        config: priceRangeConfig[price as keyof typeof priceRangeConfig]
      }))
  }, [restaurants, priceRangeConfig])

  const togglePriceRange = (priceRange: string) => {
    if (selectedPriceRanges.includes(priceRange)) {
      onPriceRangeChange(selectedPriceRanges.filter(p => p !== priceRange))
    } else {
      onPriceRangeChange([...selectedPriceRanges, priceRange])
    }
  }

  const clearAllPrices = () => {
    onPriceRangeChange([])
  }

  const selectBudgetFriendly = () => {
    onPriceRangeChange(['budget', 'mid-range'])
  }

  const isNoneSelected = selectedPriceRanges.length === 0

  const getTotalRestaurantsInRange = () => {
    if (isNoneSelected) return restaurants.length
    return restaurants.filter(r => r.price_range && selectedPriceRanges.includes(r.price_range)).length
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="size-5 text-orange-500" />
        <h3 className="font-semibold text-gray-700">{t('filters.price.title')}</h3>
        <span className="text-sm text-gray-500">
          ({getTotalRestaurantsInRange()} {t('common.restaurants')})
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-3">
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-orange-100 border-orange-200"
          onClick={clearAllPrices}
        >
          {t('common.all')}
        </Badge>
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-green-100 border-green-200"
          onClick={selectBudgetFriendly}
        >
          {t('filters.price.budgetFriendly')}
        </Badge>
      </div>

      {/* Price range badges */}
      <div className="space-y-3">
        {priceData.map(({ priceRange, count, config }) => {
          const isSelected = selectedPriceRanges.includes(priceRange) || isNoneSelected

          return (
            <div
              key={priceRange}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-gradient-to-r ' + config.color + ' text-white border-transparent shadow-md'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
              onClick={() => togglePriceRange(priceRange)}
            >
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                  {config.icon}
                </div>
                <div>
                  <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                    {config.label}
                  </div>
                  <div className={`text-sm ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                    {config.description}
                  </div>
                </div>
              </div>
              <div className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                {count}
              </div>
            </div>
          )
        })}
      </div>

      {/* Price distribution summary */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800 mb-2">{t('filters.price.distribution')}</h4>
        <div className="space-y-1">
          {priceData.map(({ priceRange, count, config }) => (
            <div key={priceRange} className="flex justify-between text-xs text-blue-700">
              <span>{config.label}</span>
              <span>{Math.round((count / restaurants.length) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
