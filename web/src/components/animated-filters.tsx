"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Filter, X } from "lucide-react"
import { LocationFilter } from "./location-filter"
import { CuisineFilter } from "./cuisine-filter"
import { PriceFilter } from "./price-filter"
import { Restaurant } from "@/types/restaurant"
import { useLanguage } from "@/contexts/LanguageContext"

interface AnimatedFiltersProps {
  restaurants: Restaurant[]
  filters: {
    selectedCity: string
    selectedRegion: string
    selectedNeighborhood: string
    selectedCuisines: string[]
    selectedPriceRanges: string[]
  }
  onFiltersChange: (filters: any) => void
  onClear: () => void
}

export function AnimatedFilters({
  restaurants,
  filters,
  onFiltersChange,
  onClear
}: AnimatedFiltersProps) {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  const containerVariants = {
    hidden: { opacity: 0, height: 0 } as any,
    visible: {
      opacity: 1,
      height: "auto",
      transition: {
        height: {
          type: "spring" as const,
          stiffness: 300,
          damping: 30
        },
        opacity: { duration: 0.2 },
        staggerChildren: 0.1
      }
    } as any,
    exit: {
      opacity: 0,
      height: 0,
      transition: {
        height: { duration: 0.3 },
        opacity: { duration: 0.2 }
      }
    } as any
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 } as any,
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 24
      }
    } as any
  }

  return (
    <Card className="border-2 border-orange-200 overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-100 to-amber-100">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 p-0 hover:bg-transparent"
          >
            {isOpen ? <X className="size-5" /> : <Filter className="size-5" />}
            <CardTitle className="text-orange-600">
              {t('common.filters')} {!isOpen && t('common.clickToExpand')}
            </CardTitle>
          </Button>
          {isOpen && (
            <Button variant="outline" onClick={onClear} size="sm">
              {t('common.clearFilters')}
            </Button>
          )}
        </div>
      </CardHeader>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <motion.div variants={itemVariants}>
                  <LocationFilter
                    restaurants={restaurants}
                    selectedCity={filters.selectedCity}
                    selectedRegion={filters.selectedRegion}
                    selectedNeighborhood={filters.selectedNeighborhood}
                    onCityChange={(city) => onFiltersChange({ ...filters, selectedCity: city })}
                    onRegionChange={(region) => onFiltersChange({ ...filters, selectedRegion: region })}
                    onNeighborhoodChange={(neighborhood) => onFiltersChange({ ...filters, selectedNeighborhood: neighborhood })}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <CuisineFilter
                    restaurants={restaurants}
                    selectedCuisines={filters.selectedCuisines}
                    onCuisineChange={(cuisines) => onFiltersChange({ ...filters, selectedCuisines: cuisines })}
                  />
                </motion.div>
                <motion.div variants={itemVariants}>
                  <PriceFilter
                    restaurants={restaurants}
                    selectedPriceRanges={filters.selectedPriceRanges}
                    onPriceRangeChange={(priceRanges) => onFiltersChange({ ...filters, selectedPriceRanges: priceRanges })}
                  />
                </motion.div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
