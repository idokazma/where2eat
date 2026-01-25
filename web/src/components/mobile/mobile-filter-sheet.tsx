"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Filter, X, MapPin, Utensils, DollarSign } from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"

interface FilterState {
  selectedCity: string
  selectedCuisines: string[]
  selectedPriceRanges: string[]
  selectedOpinions: string[]
}

interface MobileFilterSheetProps {
  cities: string[]
  cuisines: string[]
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onClear: () => void
}

export function MobileFilterSheet({
  cities,
  cuisines,
  filters,
  onFiltersChange,
  onClear
}: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  const priceRanges = ['budget', 'mid-range', 'expensive']
  const opinions = ['positive', 'mixed', 'neutral', 'negative']

  // Count active filters
  const activeFilterCount =
    (filters.selectedCity !== 'all' ? 1 : 0) +
    filters.selectedCuisines.length +
    filters.selectedPriceRanges.length +
    filters.selectedOpinions.length

  const toggleCity = (city: string) => {
    onFiltersChange({
      ...filters,
      selectedCity: city
    })
  }

  const toggleCuisine = (cuisine: string) => {
    onFiltersChange({
      ...filters,
      selectedCuisines: filters.selectedCuisines.includes(cuisine)
        ? filters.selectedCuisines.filter(c => c !== cuisine)
        : [...filters.selectedCuisines, cuisine]
    })
  }

  const togglePriceRange = (price: string) => {
    onFiltersChange({
      ...filters,
      selectedPriceRanges: filters.selectedPriceRanges.includes(price)
        ? filters.selectedPriceRanges.filter(p => p !== price)
        : [...filters.selectedPriceRanges, price]
    })
  }

  const toggleOpinion = (opinion: string) => {
    onFiltersChange({
      ...filters,
      selectedOpinions: filters.selectedOpinions.includes(opinion)
        ? filters.selectedOpinions.filter(o => o !== opinion)
        : [...filters.selectedOpinions, opinion]
    })
  }

  const handleClear = () => {
    onClear()
  }

  const handleApply = () => {
    setOpen(false)
  }

  const getPriceDisplay = (price: string) => {
    const displays: Record<string, string> = {
      'budget': '₪',
      'mid-range': '₪₪',
      'expensive': '₪₪₪'
    }
    return displays[price] || price
  }

  const getPriceLabel = (price: string) => {
    return t(`filters.price.${price === 'mid-range' ? 'midRange' : price}`)
  }

  const getOpinionEmoji = (opinion: string) => {
    const emojis: Record<string, string> = {
      'positive': '👍',
      'mixed': '🤔',
      'neutral': '😐',
      'negative': '👎'
    }
    return emojis[opinion] || ''
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="relative h-12 px-4 rounded-xl md:hidden"
        >
          <Filter className="size-5 mr-2" />
          {t('common.filters')}
          {activeFilterCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0 text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 rounded-t-3xl">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-display">
              {t('common.filters')}
            </SheetTitle>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-primary"
              >
                {t('common.clearAll')}
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Scrollable Filter Content */}
        <div className="flex-1 overflow-y-auto px-6 scrollbar-hide">
          <div className="space-y-6 py-6">
            {/* Location Section */}
            {cities.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                  <MapPin className="size-5 text-primary" />
                  {t('filters.location.title')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filters.selectedCity === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="h-11 rounded-full px-4"
                    onClick={() => toggleCity('all')}
                  >
                    {t('common.all')}
                  </Button>
                  {cities.slice(0, 8).map(city => (
                    <Button
                      key={city}
                      variant={filters.selectedCity === city ? 'default' : 'outline'}
                      size="sm"
                      className="h-11 rounded-full px-4"
                      onClick={() => toggleCity(city)}
                    >
                      {city}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Cuisine Section */}
            {cuisines.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                  <Utensils className="size-5 text-primary" />
                  {t('filters.cuisine.title')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {cuisines.slice(0, 12).map(cuisine => {
                    const isSelected = filters.selectedCuisines.includes(cuisine)
                    return (
                      <Button
                        key={cuisine}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className="h-11 rounded-full px-4"
                        onClick={() => toggleCuisine(cuisine)}
                      >
                        {cuisine}
                        {isSelected && <X className="size-3 mr-1" />}
                      </Button>
                    )
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Price Range Section */}
            <div>
              <h3 className="font-semibold mb-3 text-right flex items-center gap-2">
                <DollarSign className="size-5 text-primary" />
                {t('filters.price.title')}
              </h3>
              <div className="flex gap-2">
                {priceRanges.map(price => {
                  const isSelected = filters.selectedPriceRanges.includes(price)
                  return (
                    <Button
                      key={price}
                      variant={isSelected ? 'default' : 'outline'}
                      size="lg"
                      className="flex-1 h-14 rounded-xl flex-col gap-0"
                      onClick={() => togglePriceRange(price)}
                    >
                      <span className="text-lg font-display">{getPriceDisplay(price)}</span>
                      <span className="text-[10px] opacity-70">{getPriceLabel(price)}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Opinion Section */}
            <div>
              <h3 className="font-semibold mb-3 text-right">
                {t('search.hostOpinion')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {opinions.map(opinion => {
                  const isSelected = filters.selectedOpinions.includes(opinion)
                  return (
                    <Button
                      key={opinion}
                      variant={isSelected ? 'default' : 'outline'}
                      size="lg"
                      className="h-12 rounded-xl justify-start gap-2"
                      onClick={() => toggleOpinion(opinion)}
                    >
                      <span className="text-lg">{getOpinionEmoji(opinion)}</span>
                      <span className="text-sm">{t(`filters.opinion.${opinion}`)}</span>
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Apply Button */}
        <SheetFooter className="p-6 border-t bg-background">
          <Button
            size="lg"
            className="w-full h-14 text-base rounded-xl"
            onClick={handleApply}
          >
            {t('mobile.showResults')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// Quick filter chips component for use outside the sheet
interface QuickFilterChipsProps {
  cities: string[]
  cuisines: string[]
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

export function QuickFilterChips({
  cities,
  cuisines,
  filters,
  onFiltersChange
}: QuickFilterChipsProps) {
  const { t } = useLanguage()

  // Get top 3 popular cities
  const topCities = cities.slice(0, 3)
  // Get top 3 popular cuisines
  const topCuisines = cuisines.slice(0, 3)

  const setCity = (city: string) => {
    onFiltersChange({
      ...filters,
      selectedCity: filters.selectedCity === city ? 'all' : city
    })
  }

  const setCuisine = (cuisine: string) => {
    onFiltersChange({
      ...filters,
      selectedCuisines: filters.selectedCuisines.includes(cuisine)
        ? filters.selectedCuisines.filter(c => c !== cuisine)
        : [cuisine]  // Replace, don't add for quick filters
    })
  }

  const setBudget = () => {
    onFiltersChange({
      ...filters,
      selectedPriceRanges: filters.selectedPriceRanges.includes('budget')
        ? []
        : ['budget']
    })
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide md:hidden">
      {/* Top cities */}
      {topCities.map(city => (
        <Button
          key={city}
          variant={filters.selectedCity === city ? 'default' : 'outline'}
          size="sm"
          className="rounded-full flex-shrink-0 h-9"
          onClick={() => setCity(city)}
        >
          {city}
        </Button>
      ))}

      {/* Top cuisines */}
      {topCuisines.map(cuisine => (
        <Button
          key={cuisine}
          variant={filters.selectedCuisines.includes(cuisine) ? 'default' : 'outline'}
          size="sm"
          className="rounded-full flex-shrink-0 h-9"
          onClick={() => setCuisine(cuisine)}
        >
          {cuisine}
        </Button>
      ))}

      {/* Budget filter */}
      <Button
        variant={filters.selectedPriceRanges.includes('budget') ? 'default' : 'outline'}
        size="sm"
        className="rounded-full flex-shrink-0 h-9"
        onClick={setBudget}
      >
        ₪ {t('filters.price.budget')}
      </Button>
    </div>
  )
}
